import { useNavigate } from "@tanstack/react-router";
import {
	FileText,
	Hourglass,
	ListChecks,
	NotebookText,
	Pin,
	Sparkles,
	Trash2,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { LucideIcon } from "@/lib/lucide-icon";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import {
	type DocSessionMeta,
	groupSessions,
	initialSwitcherIndex,
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

// O switcher congela um instantâneo do MRU ao abrir (`list`), pra o dwell de gravação e as edições não
// reordenarem os cards sob o cursor. `currentKey` é a sessão aberta agora; o agrupamento a marca como
// "Sessão atual" e o `index` parte sempre do primeiro card que NÃO é ela. `index` aponta na sequência
// achatada (`cards`) que o teclado percorre, alinhada à ordem de render. `pendingCurrent` existe só
// enquanto a sessão atual ainda não foi gravada no MRU (dwell em curso): o card dela mostra a contagem
// regressiva até `recordAt`.
type SwitcherView = {
	list: DocSessionMeta[];
	currentKey: string | null;
	pendingCurrent: { key: string; recordAt: number } | null;
	index: number;
};

// Instantâneo do MRU com a sessão atual sempre presente: se ela ainda não entrou no MRU (dwell em
// curso), é prefixada como card sintético e marcada como `pendingCurrent` pro timer. Devolve null
// quando só sobraria a própria sessão atual — aí não há pra onde trocar e o overlay não deve abrir.
function buildList(): Omit<SwitcherView, "index"> | null {
	const { recents } = useDocSessionsStore.getState();
	const { current, currentRecordAt } = useDocSwitcherStore.getState();
	const currentKey = current?.key ?? null;

	const isPending = current ? !recents.some((r) => r.key === current.key) : false;
	const list = current && isPending ? [current, ...recents] : recents;

	if (!list.some((r) => r.key !== currentKey)) {
		return null;
	}

	const pendingCurrent =
		current && isPending && currentRecordAt
			? { key: current.key, recordAt: currentRecordAt }
			: null;
	return { list, currentKey, pendingCurrent };
}

function flatCards(view: SwitcherView): SessionGroupCard[] {
	return groupSessions(view.list, view.currentKey).cards;
}

// Reancora o `index` à mesma chave ativa depois de uma edição que muda a lista; se a chave sumiu,
// fixa no antigo offset (clampado). Fecha o overlay quando não resta nenhum card pra trocar.
function reanchor(view: SwitcherView, nextList: DocSessionMeta[]): SwitcherView | null {
	const { cards } = groupSessions(nextList, view.currentKey);
	if (!cards.some((c) => !c.isCurrent)) {
		return null;
	}
	const activeKey = flatCards(view)[view.index]?.key;
	const found = cards.findIndex((c) => c.key === activeKey);
	const index = found >= 0 ? found : Math.min(view.index, cards.length - 1);
	return { ...view, list: nextList, index };
}

// Switcher global de sessões de leitura. Ctrl+Tab é um TOGGLE: abre o overlay e o mantém aberto pra
// navegar com o mouse (clicar num card salta pro doc, caindo no ponto de leitura salvo — a âncora é
// restaurada pelo DocEditorPane na chave da sessão); Ctrl+Tab de novo (ou Esc, ou clicar no fundo)
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
	const clearLoose = useDocSessionsStore((s) => s.clearLoose);

	const [view, setView] = useState<SwitcherView | null>(null);
	const viewRef = useRef<SwitcherView | null>(null);
	viewRef.current = view;

	// Re-renderiza a cada tick enquanto a sessão atual conta o dwell, pra atualizar o "registra em Ns".
	const [, setTick] = useState(0);
	const pendingKey = view?.pendingCurrent?.key ?? null;
	useEffect(() => {
		if (!pendingKey) {
			return;
		}
		const id = setInterval(() => setTick((n) => n + 1), 500);
		return () => clearInterval(id);
	}, [pendingKey]);

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
	// como o Alt+Tab). Devolve false quando não há pra onde trocar.
	const openSwitcher = useCallback((): boolean => {
		const built = buildList();
		if (!built) {
			return false;
		}
		setView({ ...built, index: initialSwitcherIndex(built.list, built.currentKey) });
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

			// Ctrl+Tab é toggle: abre e deixa aberto pra navegar com o mouse; de novo fecha.
			if (event.ctrlKey && event.key === "Tab") {
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

			// Aberto, o teclado também navega: setas/Tab ciclam, Enter confirma.
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
			} else if (event.key === "Enter") {
				event.preventDefault();
				event.stopPropagation();
				confirm(cards[current.index]);
			}
		}

		// Perder o foco da janela com o overlay aberto: fecha sem navegar.
		function onBlur() {
			if (viewRef.current) {
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

	const togglePinCard = useCallback(
		(key: string) => {
			togglePin(key);
			const current = viewRef.current;
			if (!current) {
				return;
			}
			// Fixar não reordena os grupos nem a sequência achatada — o índice ativo segue válido.
			setView({
				...current,
				list: current.list.map((r) =>
					r.key === key ? Object.assign({}, r, { pinned: !r.pinned }) : r,
				),
			});
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

	const { groups, cards } = groupSessions(view.list, view.currentKey);
	const activeKey = cards[view.index]?.key ?? null;
	const getAnchor = useDocSessionsStore.getState().getAnchor;
	const hasLoose = view.list.some((r) => !r.pinned && r.key !== view.currentKey);

	const pending = view.pendingCurrent;
	const countdownFor = (key: string): number | null => {
		if (!pending || pending.key !== key) {
			return null;
		}
		return Math.max(0, Math.ceil((pending.recordAt - Date.now()) / 1000));
	};

	return (
		// Backdrop como div (não button) pra não aninhar interativos dentro de interativos — os cards
		// também são divs clicáveis com botões de fixar/remover dentro. Clicar no fundo fecha.
		/** biome-ignore lint/a11y/noStaticElementInteractions: backdrop só fecha no clique; Esc também fecha. */
		<div
			// Backdrop opaco e acima de tudo (z-[100]): translúcido, a scrollbar do conteúdo atrás
			// vazava pelos vãos entre os cards.
			className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background px-6 py-8"
			onClick={close}
		>
			<div
				className="flex max-h-full w-full max-w-5xl flex-col gap-5 overflow-y-auto"
				// O overlay fecha no clique de fundo; clicar na área dos cards não deve fechar.
				onClick={(event) => event.stopPropagation()}
			>
				{groups.map((group) => (
					<section key={group.projectName ?? "__sem-projeto__"} className="flex flex-col gap-2.5">
						<header className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							<span className="size-1.5 rounded-full bg-[var(--project-accent,var(--primary))]" />
							{group.projectName ?? "Sem projeto"}
						</header>

						<div className="flex flex-wrap items-start gap-3">
							{group.blocks.map((block) => {
								if (block.type === "doc") {
									return (
										<Card
											key={block.card.key}
											card={block.card}
											active={block.card.key === activeKey}
											countdown={countdownFor(block.card.key)}
											heading={getAnchor(block.card.key)?.headingText ?? null}
											onConfirm={confirm}
											onHover={() => focusCard(setView, cards, block.card.key)}
											onTogglePin={togglePinCard}
											onRemove={removeCard}
										/>
									);
								}
								return (
									<div
										key={block.taskId}
										className="flex flex-col gap-1.5 border border-dashed border-border/60 bg-card/30 p-2"
									>
										{/* A largura do cluster é ditada pelos cards (arquivos). O título da tarefa preenche
										    essa largura e trunca nela: w-0 não empurra a largura, min-w-full a iguala. */}
										<span className="block w-0 min-w-full truncate px-0.5 text-xs font-medium text-foreground/70">
											{block.title}
										</span>
										<div className="flex flex-wrap items-start gap-2">
											{block.cards.map((card) => (
												<Card
													key={card.key}
													card={card}
													inTask
													active={card.key === activeKey}
													countdown={countdownFor(card.key)}
													heading={getAnchor(card.key)?.headingText ?? null}
													onConfirm={confirm}
													onHover={() => focusCard(setView, cards, card.key)}
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
				))}
			</div>

			{hasLoose ? (
				<button
					type="button"
					onClick={(event) => {
						event.stopPropagation();
						clearLooseCards();
					}}
					className="flex shrink-0 items-center gap-1.5 border border-border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
					title="Remove as sessões não fixadas do histórico"
				>
					<Trash2 className="size-3.5" />
					Limpar recentes
				</button>
			) : null}
		</div>
	);
}

// Move a seleção do teclado pro card sob o mouse, casando o índice na sequência achatada pela chave.
function focusCard(
	setView: React.Dispatch<React.SetStateAction<SwitcherView | null>>,
	cards: SessionGroupCard[],
	key: string,
) {
	const index = cards.findIndex((c) => c.key === key);
	if (index < 0) {
		return;
	}
	setView((v) => (v ? { ...v, index } : v));
}

type CardProps = {
	card: SessionGroupCard;
	active: boolean;
	heading: string | null;
	// Segundos até o dwell gravar a sessão atual no MRU; null quando o card não é a sessão pendente.
	countdown: number | null;
	inTask?: boolean;
	onConfirm: (meta: DocSessionMeta) => void;
	onHover: () => void;
	onTogglePin: (key: string) => void;
	onRemove: (key: string) => void;
};

const ACCENT = "var(--project-accent, var(--primary))";

// Card de sessão. Em um cluster de tarefa (`inTask`), o título da tarefa já está no cabeçalho do
// cluster, então o card destaca o ARQUIVO; avulso, destaca o título do doc. A sessão atual ganha o
// selo "Sessão atual", o ícone na cor de acento e uma barra à esquerda; enquanto o dwell não grava,
// o rodapé conta "registra em Ns". O card sob o teclado (`active`) ganha a borda e o realce — os
// estilos podem coexistir.
function Card({
	card,
	active,
	heading,
	countdown,
	inTask,
	onConfirm,
	onHover,
	onTogglePin,
	onRemove,
}: CardProps) {
	const KindIcon = KIND_ICON[card.kind];
	const primary = inTask ? (card.subtitle ?? card.title) : card.title;
	const secondary = inTask ? null : card.subtitle;
	const iconColor = card.isCurrent ? ACCENT : card.iconColor;
	const counting = countdown !== null;

	return (
		/** biome-ignore lint/a11y/noStaticElementInteractions: card clicável; o teclado já navega pelo listener global. */
		<div
			onClick={() => onConfirm(card)}
			onMouseEnter={onHover}
			className={cn(
				"group relative flex cursor-pointer flex-col gap-3 border bg-card p-4 text-left transition-colors",
				inTask ? "w-52" : "w-60",
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
						className={cn("size-3.5 shrink-0", counting && countdown > 0 && "animate-pulse")}
						style={iconColor ? { color: iconColor } : undefined}
					/>
				) : (
					<KindIcon
						size={14}
						className={cn("shrink-0", counting && countdown > 0 && "animate-pulse")}
						style={iconColor ? { color: iconColor } : undefined}
					/>
				)}
				<span className="truncate font-medium uppercase tracking-wide">
					{KIND_LABEL[card.kind]}
				</span>
				{card.isCurrent ? (
					<span className="ml-auto truncate font-semibold uppercase tracking-wide text-[var(--project-accent,var(--primary))]">
						Sessão atual
					</span>
				) : null}
			</div>

			<div className="flex min-w-0 flex-col gap-0.5">
				<span
					className={cn(
						"line-clamp-2 font-semibold leading-tight",
						inTask ? "text-sm" : "text-base",
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
					<span className="truncate text-xs italic text-muted-foreground/60">sem ponto salvo</span>
				)}
				{counting ? (
					<span
						className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide"
						style={{ color: ACCENT }}
					>
						<Hourglass className={cn("size-3", countdown > 0 && "animate-pulse")} />
						{countdown > 0 ? `registra em ${countdown}s` : "registrada"}
					</span>
				) : (
					<span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
						{relativeTimeFrom(card.lastVisited)}
					</span>
				)}
			</div>
		</div>
	);
}
