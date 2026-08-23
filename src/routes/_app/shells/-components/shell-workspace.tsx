import { PanelLeft } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { SidebarTooltip } from "@/components/layout/sidebar-tooltip";
import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";
import { cn } from "@/lib/utils";

const RAIL_MIN = 180;
const RAIL_MAX = 520;
const RAIL_DEFAULT = 288;
const WIDTH_STEP = 16;
const WIDTH_STEP_LARGE = 48;

const WIDTH_KEY = "kowork.shells.railWidth";
const FOCUS_KEY = "kowork.shells.focusMode";

function readStoredWidth(): number {
	try {
		const stored = Number(localStorage.getItem(WIDTH_KEY));
		return Number.isFinite(stored) && stored >= RAIL_MIN && stored <= RAIL_MAX
			? stored
			: RAIL_DEFAULT;
	} catch {
		return RAIL_DEFAULT;
	}
}

function store(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Sem storage (modo privado etc.): a largura só não sobrevive à sessão.
	}
}

type ShellWorkspaceProps = {
	rail: ReactNode;
	tabs?: ReactNode;
	children: ReactNode;
};

// Lógica de janelas do bankai aplicada ao /shells: divisória que arrasta e obedece teclado,
// largura lembrada entre sessões, e modo foco — o rail some por inteiro e uma borda rente
// revela ao hover; arrastar a divisória abaixo do mínimo também entra no modo foco.
export function ShellWorkspace({ rail, tabs, children }: ShellWorkspaceProps) {
	const isMobile = useIsMobileViewport();
	const containerRef = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(readStoredWidth);
	const [focusMode, setFocusMode] = useState(() => {
		try {
			return localStorage.getItem(FOCUS_KEY) === "1";
		} catch {
			return false;
		}
	});
	const [peeking, setPeeking] = useState(false);
	const draggingRef = useRef(false);

	const applyWidth = useCallback((next: number, persist: boolean) => {
		const clamped = Math.min(Math.max(next, RAIL_MIN), RAIL_MAX);
		setWidth(clamped);
		if (persist) {
			store(WIDTH_KEY, String(clamped));
		}
	}, []);

	const enterFocusMode = useCallback((persist: boolean) => {
		setFocusMode(true);
		setPeeking(false);
		if (persist) {
			store(FOCUS_KEY, "1");
		}
	}, []);

	const exitFocusMode = useCallback(() => {
		setFocusMode(false);
		setPeeking(false);
		store(FOCUS_KEY, "0");
	}, []);

	useEffect(() => {
		if (!focusMode) {
			return;
		}

		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				exitFocusMode();
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [focusMode, exitFocusMode]);

	const startDrag = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			event.preventDefault();
			draggingRef.current = true;
			const containerLeft = containerRef.current?.getBoundingClientRect().left ?? 0;

			function onMove(move: PointerEvent) {
				if (!draggingRef.current) {
					return;
				}

				const next = move.clientX - containerLeft;
				if (next < RAIL_MIN - WIDTH_STEP) {
					enterFocusMode(true);
					return;
				}

				applyWidth(next, false);
			}

			function onUp() {
				draggingRef.current = false;
				setWidth((current) => {
					store(WIDTH_KEY, String(current));
					return current;
				});
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
			}

			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", onUp);
		},
		[applyWidth, enterFocusMode],
	);

	if (isMobile) {
		return (
			<div className="flex min-h-0 flex-1 flex-col">
				{tabs}
				{children}
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			data-component="shell-workspace"
			className="relative flex min-h-0 flex-1"
		>
			{(!focusMode || peeking) && (
				<aside
					data-component="shell-rail"
					className={cn(
						"flex min-h-0 shrink-0 flex-col border-r border-border bg-chrome/60",
						focusMode && peeking && "absolute inset-y-0 left-0 z-30 shadow-xs transition-none",
					)}
					style={{ width }}
					onMouseLeave={focusMode ? () => setPeeking(false) : undefined}
				>
					{rail}
				</aside>
			)}

			{!focusMode && (
				<div
					role="separator"
					aria-orientation="vertical"
					aria-label="Redimensionar lista de shells"
					tabIndex={0}
					onPointerDown={startDrag}
					onKeyDown={(event) => {
						if (event.key === "ArrowLeft") {
							applyWidth(width - (event.shiftKey ? WIDTH_STEP_LARGE : WIDTH_STEP), true);
							event.preventDefault();
						} else if (event.key === "ArrowRight") {
							applyWidth(width + (event.shiftKey ? WIDTH_STEP_LARGE : WIDTH_STEP), true);
							event.preventDefault();
						} else if (event.key === "Enter") {
							enterFocusMode(true);
							event.preventDefault();
						}
					}}
					className="group relative z-10 w-1 shrink-0 cursor-col-resize bg-transparent outline-none after:absolute after:inset-y-0 after:left-0 after:w-1.5 after:transition-colors hover:after:bg-primary/40 focus-visible:after:bg-primary/60"
					title="Arraste para redimensionar; abaixo do mínimo entra em modo foco"
				/>
			)}

			<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
				{focusMode && (
					<>
						<div
							aria-hidden={!peeking}
							className="absolute inset-y-0 left-0 z-20 w-3 cursor-pointer"
							onMouseEnter={() => setPeeking(true)}
							onClick={exitFocusMode}
						/>
						<SidebarTooltip
							label="Mostrar lista de shells"
							triggerClassName="absolute left-2 top-2 z-10 flex"
						>
							<button
								type="button"
								onClick={exitFocusMode}
								aria-label="Sair do modo foco"
								className="flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-40 transition-opacity hover:bg-muted hover:text-foreground hover:opacity-100"
							>
								<PanelLeft className="size-4" />
							</button>
						</SidebarTooltip>
					</>
				)}

				{tabs}

				<div className="relative flex min-h-0 min-w-0 flex-1">{children}</div>
			</div>
		</div>
	);
}
