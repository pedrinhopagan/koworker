import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FileText, ListChecks, NotebookText, Pin, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { orpc } from "@/client";
import { LucideIcon } from "@/lib/lucide-icon";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import {
	blockStartIndices,
	distinctCards,
	type DocSessionMeta,
	groupSessions,
	initialSwitcherIndex,
	jumpToBlock,
	type SessionGroupCard,
	useDocSessionsStore,
} from "@/stores/doc-sessions";
import { useDocSwitcherStore } from "@/stores/doc-switcher";
import { useSelectedProjectStore } from "@/stores/selected-project";

const KIND_ICON = {
	task: ListChecks,
	vault: NotebookText,
	docs: FileText,
	skill: Sparkles,
} as const;

const KIND_LABEL = {
	task: "Tarefa",
	vault: "Vault",
	docs: "Doc",
	skill: "Skill",
} as const;

// Rótulo plural pro cabeçalho da caixa de kind ("Skills"/"Vault"/"Docs"). `task` nunca vira caixa de
// kind (tarefas têm caixa própria com o título), mas a chave existe pra cobrir a união.
const KIND_BOX_LABEL = {
	task: "Tarefas",
	vault: "Vault",
	docs: "Docs",
	skill: "Skills",
} as const;

// O switcher congela um instantâneo do MRU ao abrir (`list`), pra o dwell de gravação e as edições não
// reordenarem os cards sob o cursor. `currentKey` é a sessão aberta agora; o agrupamento a marca como
// "Sessão atual" e o `index` parte sempre do primeiro card que NÃO é ela. `index` aponta na sequência
// achatada (`cards`) que o teclado percorre, alinhada à ordem de render.
type SwitcherView = {
	list: DocSessionMeta[];
	currentKey: string | null;
	index: number;
	// Ordem canônica das seções de projeto (display_order de `projects.list`), congelada ao abrir junto
	// da `list`: estabiliza a ordem das seções entre aberturas e mantém o `flatIndex` alinhado entre render
	// e navegação por teclado (todas as chamadas de agrupamento usam a mesma ordem).
	projectOrder: string[];
};

// Instantâneo do MRU ao abrir. A sessão atual já foi gravada no MRU por `openSwitcher`, então entra como
// qualquer recente (marcada "Sessão atual" pela `currentKey`) — não há mais card sintético nem dwell em
// curso a exibir. Devolve null só quando não há nada pra mostrar (sem sessão atual e MRU vazio).
function buildList(): Omit<SwitcherView, "index" | "projectOrder"> | null {
	const { recents } = useDocSessionsStore.getState();
	const currentKey = useDocSwitcherStore.getState().current?.key ?? null;

	if (recents.length === 0) {
		return null;
	}

	return { list: recents, currentKey };
}

function flatCards(view: SwitcherView): SessionGroupCard[] {
	return groupSessions(view.list, view.currentKey, view.projectOrder).cards;
}

// Reancora o `index` à mesma chave ativa depois de uma edição que muda a lista; se a chave sumiu,
// fixa no antigo offset (clampado). Fecha o overlay só quando não resta nenhum card — "vazio" agora é
// realmente vazio (a sessão atual sozinha mantém o overlay aberto, mostrando só ela).
function reanchor(view: SwitcherView, nextList: DocSessionMeta[]): SwitcherView | null {
	const { cards } = groupSessions(nextList, view.currentKey, view.projectOrder);
	if (cards.length === 0) {
		return null;
	}
	const activeKey = flatCards(view)[view.index]?.key;
	const found = cards.findIndex((c) => c.key === activeKey);
	const index = found >= 0 ? found : Math.min(view.index, cards.length - 1);
	return { ...view, list: nextList, index };
}

// Switcher global de sessões de leitura. Alt+` é um TOGGLE: abre o overlay e o mantém aberto pra
// navegar com o mouse (clicar num card salta pro doc, caindo no ponto de leitura salvo — a âncora é
// restaurada pelo DocEditorPane na chave da sessão); Alt+` de novo (ou Esc, ou clicar no fundo)
// fecha. Setas/Tab/Enter também navegam pelo teclado enquanto está aberto. A afordância na TabBar abre
// o mesmo overlay. Listener em CAPTURE no window pra vencer o keymap Prec.high do CodeMirror, que come
// o Tab. Os cards ficam agrupados por projeto e, dentro, por tarefa (arquivos da mesma tarefa juntos),
// com o trabalho mais recente no topo.
export function DocSessionSwitcher() {
	const navigate = useNavigate();
	const mouseOpen = useDocSwitcherStore((s) => s.mouseOpen);
	const closeMouse = useDocSwitcherStore((s) => s.close);
	const setSelectedProjectId = useSelectedProjectStore((s) => s.setSelectedProjectId);
	const togglePin = useDocSessionsStore((s) => s.togglePin);
	const removeRecent = useDocSessionsStore((s) => s.removeRecent);
	const removeRecentsByKeys = useDocSessionsStore((s) => s.removeRecentsByKeys);
	const clearLoose = useDocSessionsStore((s) => s.clearLoose);

	// Cor de cada projeto pra pintar o acento por seção: os grupos são chaveados por nome, então o
	// mapa nome→cor casa direto. Sem efeito colateral (não sincroniza o projeto selecionado).
	const projects = useQuery(orpc.projects.list.queryOptions()).data ?? [];
	const projectColor = (name: string | null): string | undefined =>
		name ? projects.find((project) => project.name === name)?.color : undefined;

	// Ordem canônica das seções (display_order de `projects.list`). Via ref pra os callbacks estáveis
	// (openSwitcher/keydown) lerem o valor atual sem entrar nas deps e recriar o listener a cada query.
	const projectOrderRef = useRef<string[]>([]);
	projectOrderRef.current = projects.map((project) => project.name);

	const [view, setView] = useState<SwitcherView | null>(null);
	const viewRef = useRef<SwitcherView | null>(null);
	viewRef.current = view;

	const open = view !== null || mouseOpen;

	const close = useCallback(() => {
		setView(null);
		if (useDocSwitcherStore.getState().mouseOpen) {
			closeMouse();
		}
	}, [closeMouse]);

	const confirm = useCallback(
		(meta: DocSessionMeta | undefined) => {
			close();
			if (!meta) {
				return;
			}
			if (meta.projectId) {
				setSelectedProjectId(meta.projectId);
			}
			// `to`/`params` vêm do MRU como strings cruas; o tipo estrito do navigate não cobre o caso
			// dinâmico, mas as rotas foram gravadas pelas próprias páginas (válidas por construção).
			navigate({ to: meta.nav.to, params: meta.nav.params } as unknown as Parameters<
				typeof navigate
			>[0]);
		},
		[close, navigate, setSelectedProjectId],
	);

	// Abre o overlay com a seleção do teclado no primeiro card que não é a sessão atual (o doc anterior,
	// como o Alt+Tab); só com a sessão atual, a seleção cai nela mesma. Devolve false quando não há nada
	// pra mostrar (sem sessão atual e MRU vazio).
	const openSwitcher = useCallback((): boolean => {
		// Abrir o switcher grava a sessão atual no MRU na hora (sem esperar o dwell): o doc em foco entra
		// sempre na lista de sessões. Só se ainda não estiver lá — `recordVisit` já dedupe por chave.
		const { current } = useDocSwitcherStore.getState();
		if (current && !useDocSessionsStore.getState().recents.some((r) => r.key === current.key)) {
			useDocSessionsStore.getState().recordVisit(current);
		}
		const built = buildList();
		if (!built) {
			return false;
		}
		const projectOrder = projectOrderRef.current;
		setView({
			...built,
			projectOrder,
			index: initialSwitcherIndex(built.list, built.currentKey, projectOrder),
		});
		return true;
	}, []);

	// Modo mouse: abrir via botão da TabBar congela a lista atual do MRU. Sem nada pra trocar, não há o
	// que mostrar — fecha de volta pra `mouseOpen` não ficar preso em true (o overlay renderiza null).
	useEffect(() => {
		if (mouseOpen && !viewRef.current && !openSwitcher()) {
			closeMouse();
		}
	}, [mouseOpen, closeMouse, openSwitcher]);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			const current = viewRef.current;

			// Alt+` é toggle: abre e deixa aberto pra navegar com o mouse; de novo fecha. Usa `code`
			// (tecla física) porque ` é dead key em vários layouts — `event.key` só resolveria no 2º toque.
			if (event.altKey && event.code === "Backquote") {
				event.preventDefault();
				event.stopPropagation();

				if (current) {
					close();
					return;
				}
				openSwitcher();
				return;
			}

			if (!current) {
				return;
			}

			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				close();
				return;
			}

			// Aberto, o teclado também navega: ←→/Tab ciclam todos os cards (wrap circular), ↑↓ pulam
			// entre caixas, 1–9 saltam pro N-ésimo card distinto, Enter confirma.
			const cards = flatCards(current);
			const len = cards.length;
			if (event.key === "ArrowRight" || event.key === "Tab") {
				event.preventDefault();
				event.stopPropagation();
				setView({ ...current, index: (current.index + (event.shiftKey ? -1 : 1) + len) % len });
			} else if (event.key === "ArrowLeft") {
				event.preventDefault();
				event.stopPropagation();
				setView({ ...current, index: (current.index - 1 + len) % len });
			} else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				event.stopPropagation();
				const starts = blockStartIndices(current.list, current.currentKey, current.projectOrder);
				setView({
					...current,
					index: jumpToBlock(starts, current.index, event.key === "ArrowDown" ? 1 : -1),
				});
			} else if (event.key >= "1" && event.key <= "9") {
				const target = distinctCards(cards)[Number(event.key) - 1];
				if (target) {
					event.preventDefault();
					event.stopPropagation();
					setView({ ...current, index: target.flatIndex });
				}
			} else if (event.key === "Enter") {
				event.preventDefault();
				event.stopPropagation();
				confirm(cards[current.index]);
			}
		}

		// Perder o foco da JANELA com o overlay aberto: fecha sem navegar. `document.hasFocus()` separa
		// isso de um blur espúrio quando o foco só anda entre os cards do overlay (roving tabindex) —
		// aí a janela ainda tem foco e o overlay não deve fechar.
		function onBlur() {
			if (viewRef.current && !document.hasFocus()) {
				close();
			}
		}

		window.addEventListener("keydown", onKeyDown, true);
		window.addEventListener("blur", onBlur);
		return () => {
			window.removeEventListener("keydown", onKeyDown, true);
			window.removeEventListener("blur", onBlur);
		};
	}, [close, confirm, openSwitcher]);

	// Some com as scrollbars da página enquanto o overlay está aberto (ver regra .doc-switcher-open
	// em index.css): a scrollbar do CodeMirror é pintada acima do conteúdo e vazaria sobre o overlay.
	useEffect(() => {
		if (!open) {
			return;
		}
		const root = document.documentElement;
		root.classList.add("doc-switcher-open");
		return () => root.classList.remove("doc-switcher-open");
	}, [open]);

	// Editar a lista pelo overlay mexe no store E na lista congelada do `view` (que não reflete o store
	// sozinha), reancorando o índice. Esvaziar a faixa de cards trocáveis fecha o overlay.
	const removeCard = useCallback(
		(key: string) => {
			removeRecent(key);
			const current = viewRef.current;
			if (!current) {
				return;
			}
			const next = reanchor(
				current,
				current.list.filter((r) => r.key !== key),
			);
			if (!next) {
				close();
				return;
			}
			setView(next);
		},
		[removeRecent, close],
	);

	// Fecha de uma vez todos os arquivos de uma tarefa ou de um projeto. Espelha o X de cada card (tira
	// fixadas inclusive), só que sobre o conjunto de chaves do bloco/grupo, reancorando como o removeCard.
	const removeKeys = useCallback(
		(keys: string[]) => {
			removeRecentsByKeys(keys);
			const current = viewRef.current;
			if (!current) {
				return;
			}
			const drop = new Set(keys);
			const next = reanchor(
				current,
				current.list.filter((r) => !drop.has(r.key)),
			);
			if (!next) {
				close();
				return;
			}
			setView(next);
		},
		[removeRecentsByKeys, close],
	);

	const togglePinCard = useCallback(
		(key: string) => {
			togglePin(key);
			const current = viewRef.current;
			if (!current) {
				return;
			}
			// Fixar/desafixar move o card entre a seção Fixadas e o grupo do projeto, então a sequência
			// achatada se desloca — reancora o índice à mesma chave ativa.
			const nextList = current.list.map((r) =>
				r.key === key ? Object.assign({}, r, { pinned: !r.pinned }) : r,
			);
			const next = reanchor(current, nextList);
			setView(next ?? { ...current, list: nextList });
		},
		[togglePin],
	);

	const clearLooseCards = useCallback(() => {
		clearLoose();
		const current = viewRef.current;
		if (!current) {
			return;
		}
		// A sessão atual sintética (pinned:false) sobrevive ao "limpar": ela não está no MRU do store.
		const next = reanchor(
			current,
			current.list.filter((r) => r.pinned || r.key === current.currentKey),
		);
		if (!next) {
			close();
			return;
		}
		setView(next);
	}, [clearLoose, close]);

	if (!view) {
		return null;
	}

	const { pinned, skills, groups, cards } = groupSessions(
		view.list,
		view.currentKey,
		view.projectOrder,
	);
	const getAnchor = useDocSessionsStore.getState().getAnchor;
	const hasLoose = view.list.some((r) => !r.pinned && r.key !== view.currentKey);
	const activeCard = cards[view.index] ?? null;

	// Sessão mais recente = 1º não-atual na ordem MRU (== o card onde o teclado começa). Ganha o selo
	// "Mais recente", espelhando o "Sessão atual". Marca por chave: um fixado mais-recente acende as duas
	// ocorrências, igual ao card atual quando fixado.
	const mostRecentKey = view.list.find((r) => r.key !== view.currentKey)?.key ?? null;

	return (
		// Backdrop como div (não button) pra não aninhar interativos dentro de interativos — os cards
		// também são divs clicáveis com botões de fixar/remover dentro. Clicar no fundo fecha.
		/** biome-ignore lint/a11y/noStaticElementInteractions: backdrop só fecha no clique; Esc também fecha. */
		<div
			// Backdrop translúcido com blur (z-[100]). A scrollbar do CodeMirror (WebKitGTK) vazava pelos
			// vãos quando translúcido — por isso o hack `.doc-switcher-open` esconde as scrollbars da
			// página enquanto o overlay está aberto. Se voltar a vazar, reverter pra `bg-background` opaco.
			className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background/80 px-6 py-8 backdrop-blur-sm"
			onClick={close}
		>
			{/* Anuncia o card sob a seleção do teclado pra leitores de tela, sem ocupar espaço visual. */}
			<div className="sr-only" aria-live="polite">
				{activeCard
					? `${KIND_LABEL[activeCard.kind]}: ${activeCard.title}${activeCard.isCurrent ? " — sessão atual" : ""}`
					: ""}
			</div>

			<div className="absolute top-4 right-6 flex items-center gap-2">
				{hasLoose ? (
					<button
						type="button"
						onClick={(event) => {
							event.stopPropagation();
							clearLooseCards();
						}}
						className="flex items-center gap-1.5 border border-border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
						title="Remove as sessões não fixadas do histórico"
					>
						<Trash2 className="size-3.5" />
						Limpar recentes
					</button>
				) : null}
				<button
					type="button"
					onClick={(event) => {
						event.stopPropagation();
						close();
					}}
					className="flex items-center justify-center border border-border bg-card/80 p-1.5 text-muted-foreground transition-colors hover:text-foreground"
					title="Fechar (Esc)"
					aria-label="Fechar"
				>
					<X className="size-4" />
				</button>
			</div>

			<div
				role="listbox"
				aria-label="Sessões de leitura"
				className="flex max-h-full w-full max-w-5xl flex-col gap-5 overflow-y-auto px-2"
				// O overlay fecha no clique de fundo; clicar na área dos cards não deve fechar.
				onClick={(event) => event.stopPropagation()}
			>
				{pinned.length > 0 ? (
					<section className="flex flex-col gap-2.5">
						<header className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							<Pin className="size-3 fill-current" />
							Fixadas
						</header>
						{/* Flat, sem caixas por kind: é uma seção cross-cutting. Os fixados saem do geral e
						    aparecem só aqui. `boxed={false}` mostra o rótulo do kind (sem cabeçalho de caixa
						    pra contextualizar). */}
						<div className="flex flex-wrap items-start gap-3">
							{pinned.map((card) => (
								<Card
									key={`pinned:${card.key}`}
									card={card}
									accentColor={projectColor(card.projectName ?? null)}
									boxed={false}
									active={card.flatIndex === view.index}
									isMostRecent={card.key === mostRecentKey}
									heading={getAnchor(card.key)?.headingText ?? null}
									onConfirm={confirm}
									onHover={() => focusCard(setView, card.flatIndex)}
									onTogglePin={togglePinCard}
									onRemove={removeCard}
								/>
							))}
						</div>
					</section>
				) : null}

				{groups.map((group) => {
					const accentColor = projectColor(group.projectName);
					return (
						<section
							key={group.projectName ?? "__sem-projeto__"}
							className="group/project flex flex-col gap-2.5"
							// Acento do projeto desta seção: o dot do cabeçalho e os ícones/realces dos cards
							// herdam `--project-accent` daqui. Sem cor (ou "Sem projeto"), cai no `--primary`.
							style={
								accentColor
									? ({ "--project-accent": accentColor } as React.CSSProperties)
									: undefined
							}
						>
							<header className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								<span className="size-1.5 rounded-full bg-[var(--project-accent,var(--primary))]" />
								{group.projectName ?? "Sem projeto"}
								<CloseGroupButton
									keys={group.blocks.flatMap((block) => block.cards.map((card) => card.key))}
									label={`Fechar tudo de ${group.projectName ?? "Sem projeto"}`}
									revealClass="-ml-0.5 group-hover/project:opacity-100"
									onRemove={removeKeys}
								/>
							</header>

							<div className="flex flex-wrap items-start gap-3">
								{group.blocks.map((block) => {
									const isTask = block.type === "task";
									return (
										<div
											key={isTask ? `task:${block.taskId}` : `kind:${block.kind}`}
											className="group/box relative flex flex-col gap-1.5 border border-dashed border-border/60 bg-card/30 p-2"
										>
											{/* Caixa de kind (Vault/Docs): cabeçalho com o rótulo (a largura é ditada pelos cards, e o
											    rótulo trunca nela — w-0 não empurra, min-w-full iguala) e o botão "fechar tudo" à direita.
											    Caixa de tarefa não repete o título (cada card já o carrega em negrito): o botão fica
											    absoluto na esquina superior esquerda da caixa, sobre os cards. Ambos revelados no hover. */}
											{isTask ? (
												<CloseGroupButton
													keys={block.cards.map((card) => card.key)}
													label={`Fechar todos os arquivos de ${block.title}`}
													revealClass="absolute -top-2 -left-2 z-10 group-hover/box:opacity-100"
													onRemove={removeKeys}
												/>
											) : (
												<div className="flex w-0 min-w-full items-center gap-1 px-0.5">
													<span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
														{KIND_BOX_LABEL[block.kind]}
													</span>
													<CloseGroupButton
														keys={block.cards.map((card) => card.key)}
														label={`Fechar tudo de ${KIND_BOX_LABEL[block.kind]}`}
														revealClass="ml-auto group-hover/box:opacity-100"
														onRemove={removeKeys}
													/>
												</div>
											)}
											<div className="flex flex-wrap items-start gap-2">
												{block.cards.map((card) => (
													<Card
														key={card.key}
														card={card}
														boxed={!isTask}
														active={card.flatIndex === view.index}
														isMostRecent={card.key === mostRecentKey}
														heading={getAnchor(card.key)?.headingText ?? null}
														onConfirm={confirm}
														onHover={() => focusCard(setView, card.flatIndex)}
														onTogglePin={togglePinCard}
														onRemove={removeCard}
													/>
												))}
											</div>
										</div>
									);
								})}
							</div>
						</section>
					);
				})}

				{skills.length > 0 ? (
					<section className="flex flex-col gap-2.5">
						<header className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							<Sparkles className="size-3" />
							Skills
						</header>
						{/* Skills são globais e únicas: seção flat, sem caixa tracejada. `boxed` esconde o rótulo
						    "SKILL" do card (o cabeçalho da seção já diz "Skills"); o ícone próprio da skill fica. */}
						<div className="flex flex-wrap items-start gap-3">
							{skills.map((card) => (
								<Card
									key={`skill:${card.key}`}
									card={card}
									boxed
									active={card.flatIndex === view.index}
									isMostRecent={card.key === mostRecentKey}
									heading={getAnchor(card.key)?.headingText ?? null}
									onConfirm={confirm}
									onHover={() => focusCard(setView, card.flatIndex)}
									onTogglePin={togglePinCard}
									onRemove={removeCard}
								/>
							))}
						</div>
					</section>
				) : null}
			</div>
		</div>
	);
}

// Botão "fechar tudo" de um bloco (tarefa) ou grupo (projeto): tira todas as sessões do conjunto de uma
// vez, como aplicar o X de cada card. Revelado no hover do container (`group-hover`), alinhado à direita.
function CloseGroupButton({
	keys,
	label,
	revealClass,
	onRemove,
}: {
	keys: string[];
	label: string;
	// Variante group-hover nomeada (group-hover/project ou /box): o hover do projeto não revela os botões
	// das caixas internas e vice-versa, já que os dois containers são `group` aninhados.
	revealClass: string;
	onRemove: (keys: string[]) => void;
}) {
	return (
		<button
			type="button"
			onClick={(event) => {
				event.stopPropagation();
				onRemove(keys);
			}}
			title={label}
			aria-label={label}
			className={cn(
				"flex items-center text-muted-foreground/50 opacity-0 transition-colors hover:text-destructive",
				revealClass,
			)}
		>
			<Trash2 className="size-3.5" />
		</button>
	);
}

// Move a seleção do teclado pro card sob o mouse. Recebe o flatIndex do próprio card (não a chave),
// casando a posição exata na sequência achatada.
function focusCard(
	setView: React.Dispatch<React.SetStateAction<SwitcherView | null>>,
	index: number,
) {
	setView((v) => (v ? { ...v, index } : v));
}

type CardProps = {
	card: SessionGroupCard;
	active: boolean;
	heading: string | null;
	// Sessão mais recente não-atual: ganha o selo "Mais recente" (espelha o "Sessão atual").
	isMostRecent: boolean;
	// Em caixa com cabeçalho de kind (Vault/Docs) ou na seção Skills, o contexto já está no cabeçalho → o
	// card some com o texto do KIND_LABEL (mantém o ícone). Fixadas e cards de tarefa mantêm o rótulo.
	boxed: boolean;
	// Acento do projeto do próprio card. Os cards agrupados herdam `--project-accent` da `<section>` do
	// projeto; a seção Fixadas é cross-cutting e flat, então cada fixado precisa carregar a cor do SEU
	// projeto aqui (sem isto, cairiam no `--primary` do projeto em foco).
	accentColor?: string;
	onConfirm: (meta: DocSessionMeta) => void;
	onHover: () => void;
	onTogglePin: (key: string) => void;
	onRemove: (key: string) => void;
};

// Card de sessão, com a mesma anatomia da fixada: o nome (título da tarefa/doc/skill) em negrito e, abaixo,
// o arquivo em menor. A sessão atual ganha o selo "Sessão atual", o ícone na cor de acento e uma barra à
// esquerda; a mais recente ganha o selo "Mais recente". O card sob o teclado (`active`) ganha a borda e o
// realce — os estilos coexistem.
function Card({
	card,
	active,
	heading,
	isMostRecent,
	boxed,
	accentColor,
	onConfirm,
	onHover,
	onTogglePin,
	onRemove,
}: CardProps) {
	const KindIcon = KIND_ICON[card.kind];
	const primary = card.title;
	const secondary = card.subtitle;
	// Skill mantém a cor própria do ícone (salvo na sessão atual, que vai pro acento); as demais
	// superfícies pintam o ícone com o acento do projeto (herdado por seção). O KIND_LABEL textual só
	// aparece fora de caixa e quando nenhum selo (atual/recente) já ocupa o espaço à direita.
	const skillColor = card.icon && !card.isCurrent ? card.iconColor : undefined;
	const showKindLabel = !boxed && !card.isCurrent && !isMostRecent;

	// Acompanha a seleção do teclado: ao virar o card ativo, rola pra dentro da viewport e recebe o foco
	// (roving tabindex). `nearest` não salta se já está visível; `preventScroll` evita brigar com o rolar.
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (active) {
			ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
			ref.current?.focus({ preventScroll: true });
		}
	}, [active]);

	return (
		/** biome-ignore lint/a11y/noStaticElementInteractions: card clicável; o teclado navega pelo listener global. */
		<div
			ref={ref}
			role="option"
			aria-selected={active}
			tabIndex={active ? 0 : -1}
			onClick={() => onConfirm(card)}
			onMouseEnter={onHover}
			style={accentColor ? ({ "--project-accent": accentColor } as React.CSSProperties) : undefined}
			className={cn(
				"group relative flex cursor-pointer flex-col gap-3 border bg-card p-4 text-left transition-colors outline-none",
				"w-52",
				active
					? "border-[var(--project-accent,var(--primary))] bg-secondary shadow-lg"
					: "border-border hover:bg-secondary/50",
				card.isCurrent && "border-l-2 border-l-[var(--project-accent,var(--primary))]",
			)}
		>
			<div className="absolute top-1.5 right-1.5 flex items-center gap-0.5">
				<button
					type="button"
					onClick={(event) => {
						event.stopPropagation();
						onTogglePin(card.key);
					}}
					title={card.pinned ? "Desafixar" : "Fixar"}
					aria-label={card.pinned ? "Desafixar sessão" : "Fixar sessão"}
					aria-pressed={card.pinned}
					className={cn(
						"flex size-6 items-center justify-center transition-colors",
						card.pinned
							? "text-[var(--project-accent,var(--primary))]"
							: "text-muted-foreground/50 opacity-0 hover:text-foreground group-hover:opacity-100",
					)}
				>
					<Pin className={cn("size-3.5", card.pinned && "fill-current")} />
				</button>
				<button
					type="button"
					onClick={(event) => {
						event.stopPropagation();
						onRemove(card.key);
					}}
					title="Remover do histórico"
					aria-label="Remover sessão do histórico"
					className="flex size-6 items-center justify-center text-muted-foreground/50 opacity-0 transition-colors hover:text-destructive group-hover:opacity-100"
				>
					<X className="size-3.5" />
				</button>
			</div>

			<div className="flex items-center gap-2 pr-12 text-xs text-muted-foreground">
				{card.icon ? (
					<LucideIcon
						name={card.icon}
						className="size-3.5 shrink-0 text-[var(--project-accent,var(--primary))]"
						style={skillColor ? { color: skillColor } : undefined}
					/>
				) : (
					<KindIcon size={14} className="shrink-0 text-[var(--project-accent,var(--primary))]" />
				)}
				{showKindLabel ? (
					<span className="truncate font-medium uppercase tracking-wide">
						{KIND_LABEL[card.kind]}
					</span>
				) : null}
				{card.isCurrent ? (
					<span className="ml-auto shrink-0 whitespace-nowrap font-semibold uppercase tracking-wide text-[var(--project-accent,var(--primary))]">
						Sessão atual
					</span>
				) : null}
				{isMostRecent ? (
					<span className="ml-auto shrink-0 whitespace-nowrap font-semibold uppercase tracking-wide text-muted-foreground">
						Mais recente
					</span>
				) : null}
			</div>

			<div className="flex min-w-0 flex-col gap-0.5">
				<span
					className={cn(
						"line-clamp-2 min-h-[2.5rem] text-base font-semibold leading-tight",
						active ? "text-foreground" : "text-foreground/90",
					)}
				>
					{primary}
				</span>
				{secondary ? (
					<span className="truncate font-mono text-xs text-muted-foreground">{secondary}</span>
				) : null}
			</div>

			<div className="mt-auto flex flex-col gap-1 border-t border-border/60 pt-2">
				{heading ? (
					<span className="truncate text-xs text-foreground/70">▸ {heading}</span>
				) : (
					<span className="truncate text-xs italic text-muted-foreground">sem ponto salvo</span>
				)}
				<span className="text-[10px] uppercase tracking-wide text-muted-foreground">
					{relativeTimeFrom(card.lastVisited)}
				</span>
			</div>
		</div>
	);
}
