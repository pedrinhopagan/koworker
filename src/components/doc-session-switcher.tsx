import { useNavigate } from "@tanstack/react-router";
import { FileText, ListChecks, NotebookText, Pin, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { LucideIcon } from "@/lib/lucide-icon";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { type DocSessionMeta, useDocSessionsStore } from "@/stores/doc-sessions";
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

type SwitcherView = {
	index: number;
	list: DocSessionMeta[];
};

// A lista do MRU menos o doc onde você já está (`currentKey`), então o índice 0 é sempre o doc
// anterior — comportamento de Alt+Tab. Sem isso, o dwell de gravação faria `recents[0]` ora ser o
// atual, ora o anterior, e o ponto de partida ficaria não-determinístico.
function openList(): DocSessionMeta[] {
	const { recents } = useDocSessionsStore.getState();
	const { currentKey } = useDocSwitcherStore.getState();
	return recents.filter((r) => r.key !== currentKey);
}

// Switcher global de sessões de leitura. Ctrl+Tab é um TOGGLE: abre o overlay e o mantém aberto pra
// navegar com o mouse (clicar num card salta pro doc, caindo no ponto de leitura salvo — a âncora da
// Slice A é restaurada pelo DocEditorPane na chave da sessão); Ctrl+Tab de novo (ou Esc, ou clicar no
// fundo) fecha. Setas/Tab/Enter também navegam pelo teclado enquanto está aberto. A afordância na
// TabBar abre o mesmo overlay. Listener em CAPTURE no window pra vencer o keymap Prec.high do
// CodeMirror, que come o Tab.
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

	const open = view !== null || mouseOpen;
	const list = view?.list ?? [];
	const index = view?.index ?? 0;

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

	// Modo mouse: abrir via botão da TabBar congela a lista atual do MRU. Sem sessões, não há o que
	// mostrar — fecha de volta pra `mouseOpen` não ficar preso em true (o overlay renderiza null).
	useEffect(() => {
		if (mouseOpen && !viewRef.current) {
			const next = openList();
			if (next.length) {
				setView({ index: 0, list: next });
			} else {
				closeMouse();
			}
		}
	}, [mouseOpen, closeMouse]);

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
				const next = openList();
				if (!next.length) {
					return;
				}
				setView({ index: 0, list: next });
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
			const len = current.list.length;
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
				confirm(current.list[current.index]);
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
	}, [close, confirm]);

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

	// Editar a lista pelo overlay mexe no store E na lista congelada do `view` (que não reflete o
	// store sozinha), reancorando o índice. Esvaziar a faixa fecha o overlay.
	const removeCard = useCallback(
		(key: string) => {
			removeRecent(key);
			const current = viewRef.current;
			if (!current) {
				return;
			}
			const next = current.list.filter((r) => r.key !== key);
			if (!next.length) {
				close();
				return;
			}
			setView({ ...current, list: next, index: Math.min(current.index, next.length - 1) });
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
		const next = current.list.filter((r) => r.pinned);
		if (!next.length) {
			close();
			return;
		}
		setView({ ...current, list: next, index: Math.min(current.index, next.length - 1) });
	}, [clearLoose, close]);

	if (!open || !list.length) {
		return null;
	}

	const getAnchor = useDocSessionsStore.getState().getAnchor;
	const hasLoose = list.some((meta) => !meta.pinned);

	return (
		// Backdrop como div (não button) pra não aninhar interativos dentro de interativos — os cards
		// também são divs clicáveis com botões de fixar/remover dentro. Clicar no fundo fecha.
		/** biome-ignore lint/a11y/noStaticElementInteractions: backdrop só fecha no clique; Esc também fecha. */
		<div
			// Backdrop opaco e acima de tudo (z-[100]): translúcido, a scrollbar do conteúdo atrás
			// vazava pelos vãos entre os cards.
			className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background px-6"
			onClick={close}
		>
			<div
				className="flex max-w-full flex-wrap items-stretch justify-center gap-3"
				// O overlay fecha no clique de fundo; clicar dentro da faixa de cards não deve fechar.
				onClick={(event) => event.stopPropagation()}
			>
				{list.map((meta, i) => {
					const KindIcon = KIND_ICON[meta.kind];
					const heading = getAnchor(meta.key)?.headingText ?? null;
					const active = i === index;
					return (
						/** biome-ignore lint/a11y/noStaticElementInteractions: card clicável; o teclado já navega pelo listener global. */
						<div
							key={meta.key}
							onClick={() => confirm(meta)}
							onMouseEnter={() => setView((v) => (v ? { ...v, index: i } : v))}
							className={cn(
								"group relative flex w-64 cursor-pointer flex-col gap-3 border bg-card p-4 text-left transition-colors",
								active
									? "border-[var(--project-accent,var(--primary))] bg-secondary shadow-lg"
									: "border-border hover:bg-secondary/50",
							)}
						>
							<div className="absolute top-1.5 right-1.5 flex items-center gap-0.5">
								<button
									type="button"
									onClick={(event) => {
										event.stopPropagation();
										togglePinCard(meta.key);
									}}
									title={meta.pinned ? "Desafixar" : "Fixar"}
									aria-label={meta.pinned ? "Desafixar sessão" : "Fixar sessão"}
									aria-pressed={meta.pinned}
									className={cn(
										"flex size-6 items-center justify-center transition-colors",
										meta.pinned
											? "text-[var(--project-accent,var(--primary))]"
											: "text-muted-foreground/50 opacity-0 hover:text-foreground group-hover:opacity-100",
									)}
								>
									<Pin className={cn("size-3.5", meta.pinned && "fill-current")} />
								</button>
								<button
									type="button"
									onClick={(event) => {
										event.stopPropagation();
										removeCard(meta.key);
									}}
									title="Remover do histórico"
									aria-label="Remover sessão do histórico"
									className="flex size-6 items-center justify-center text-muted-foreground/50 opacity-0 transition-colors hover:text-destructive group-hover:opacity-100"
								>
									<X className="size-3.5" />
								</button>
							</div>

							<div className="flex items-center gap-2 pr-12 text-xs text-muted-foreground">
								{meta.icon ? (
									<LucideIcon
										name={meta.icon}
										className="size-3.5 shrink-0"
										style={meta.iconColor ? { color: meta.iconColor } : undefined}
									/>
								) : (
									<KindIcon size={14} className="shrink-0" />
								)}
								<span className="truncate font-medium uppercase tracking-wide">
									{KIND_LABEL[meta.kind]}
								</span>
								{meta.projectName ? (
									<span className="ml-auto truncate opacity-70">{meta.projectName}</span>
								) : null}
							</div>

							<div className="flex min-w-0 flex-col gap-0.5">
								<span
									className={cn(
										"line-clamp-2 text-base font-semibold leading-tight",
										active ? "text-foreground" : "text-foreground/90",
									)}
								>
									{meta.title}
								</span>
								{meta.subtitle ? (
									<span className="truncate font-mono text-xs text-muted-foreground">
										{meta.subtitle}
									</span>
								) : null}
							</div>

							<div className="mt-auto flex flex-col gap-1 border-t border-border/60 pt-2">
								{heading ? (
									<span className="truncate text-xs text-foreground/70">▸ {heading}</span>
								) : (
									<span className="truncate text-xs italic text-muted-foreground/60">
										sem ponto salvo
									</span>
								)}
								<span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
									{relativeTimeFrom(meta.lastVisited)}
								</span>
							</div>
						</div>
					);
				})}
			</div>

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
		</div>
	);
}
