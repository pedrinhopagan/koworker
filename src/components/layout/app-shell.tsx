import { useRouterState } from "@tanstack/react-router";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { useState } from "react";
import { X } from "lucide-react";
import { AppContextMenu } from "@/components/layout/app-context-menu";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DocSessionSwitcher } from "@/components/doc-session-switcher";
import { NavActionDialogs } from "@/components/layout/nav-action-dialogs";
import { PinnedPane } from "@/components/layout/pinned-pane";
import { GlobalProjectSelectDialog } from "@/components/layout/project-select-dialog";
import { StatusBar } from "@/components/layout/status-bar";
import { TabBar } from "@/components/layout/tab-bar";
import { GlobalPromptBar } from "@/components/prompt-bar/global-prompt-bar";
import { MobilePromptBar } from "@/components/prompt-bar/mobile-prompt-bar";
import { MobileExecutionShortcut } from "@/components/layout/mobile-execution-shortcut";
import { useIsMobileViewport, usePrimaryColor, useProjectFocus, useUser } from "@/hooks";
import {
	isSessionPath,
	maxSplitPaneWidth,
	SPLIT_PANE_MIN,
	useSplitViewStore,
} from "@/stores/split-view";
import { cn } from "@/lib/utils";
import { useReadingModeStore } from "@/stores/reading-mode";

type AppShellProps = {
	children: ReactNode;
};

function shouldUseNativeContextMenu(target: EventTarget | null) {
	if (window.matchMedia("(pointer: coarse)").matches || window.getSelection()?.toString()) {
		return true;
	}

	return (
		target instanceof HTMLElement &&
		!!target.closest(
			'input, textarea, select, [contenteditable="true"], [contenteditable=""], .cm-editor, .xterm',
		)
	);
}

const WIDTH_STEP = 16;
const WIDTH_STEP_LARGE = 48;

export function SplitPanes({ children }: AppShellProps) {
	const storedWidth = useSplitViewStore((state) => state.width);
	const setWidth = useSplitViewStore((state) => state.setWidth);
	const unpin = useSplitViewStore((state) => state.unpin);
	const [dragWidth, setDragWidth] = useState<number | null>(null);

	function clamp(width: number) {
		return Math.min(Math.max(width, SPLIT_PANE_MIN), maxSplitPaneWidth());
	}

	const paneWidth = dragWidth ?? clamp(storedWidth);

	function startDrag(event: React.PointerEvent<HTMLDivElement>) {
		event.preventDefault();

		function onMove(move: PointerEvent) {
			setDragWidth(clamp(move.clientX));
		}

		function onUp() {
			setDragWidth((current) => {
				if (current !== null) {
					setWidth(current);
				}
				return current;
			});
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		}

		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	}

	return (
		<>
			<div
				className="relative flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-border bg-background"
				style={{ width: paneWidth }}
			>
				<PinnedPane />
			</div>

			<div
				role="separator"
				aria-orientation="vertical"
				aria-label="Redimensionar aba fixada"
				tabIndex={0}
				onPointerDown={startDrag}
				onKeyDown={(event) => {
					if (event.key === "ArrowLeft") {
						setWidth(paneWidth - (event.shiftKey ? WIDTH_STEP_LARGE : WIDTH_STEP));
						event.preventDefault();
					} else if (event.key === "ArrowRight") {
						setWidth(paneWidth + (event.shiftKey ? WIDTH_STEP_LARGE : WIDTH_STEP));
						event.preventDefault();
					}
				}}
				className="group relative z-30 w-1 shrink-0 cursor-col-resize outline-none after:absolute after:inset-y-0 after:left-0 after:w-1.5 after:transition-colors hover:after:bg-primary/40 focus-visible:after:bg-primary/60"
				title="Arraste para redimensionar a aba fixada"
			>
				<button
					type="button"
					onClick={unpin}
					aria-label="Fechar aba fixada"
					className="absolute top-2 left-1/2 z-40 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-chrome text-muted-foreground opacity-0 shadow-xs transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
				>
					<X className="size-3.5" />
				</button>
			</div>

			<div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
		</>
	);
}

export function AppShell({ children }: AppShellProps) {
	useUser();
	usePrimaryColor();
	const { accent } = useProjectFocus();
	const isMobile = useIsMobileViewport();
	const reading = useReadingModeStore((s) => s.reading);

	const pinnedPath = useSplitViewStore((s) => s.left);
	const splitActive = !isMobile && !!pinnedPath;

	const inSession = useRouterState({
		select: (state) => {
			const pathname = state.location.pathname;
			return (
				pathname === "/shells" ||
				pathname.startsWith("/shells/") ||
				pathname.startsWith("/terminals")
			);
		},
	});
	const inTerminalConversation = useRouterState({
		select: (state) => {
			const pathname = state.location.pathname;
			return (
				pathname.startsWith("/terminals/") ||
				pathname === "/shells" ||
				pathname.startsWith("/shells/")
			);
		},
	});

	const pinnedSession = pinnedPath !== null && isSessionPath(pinnedPath.split("?")[0] ?? "");
	const hidePromptBar = inSession || pinnedSession;

	const baseAccentStyle = {
		"--project-accent-soft": "color-mix(in oklab, var(--primary) 12%, transparent)",
		"--project-accent-muted": "color-mix(in oklab, var(--primary) 8%, transparent)",
		"--project-accent-border": "color-mix(in oklab, var(--primary) 45%, transparent)",
		"--project-accent-glow": "color-mix(in oklab, var(--primary) 40%, transparent)",
	} as CSSProperties;

	const shellStyle = accent
		? ({
				...baseAccentStyle,
				"--project-accent": accent.color,
				"--project-accent-soft": accent.soft,
				"--project-accent-muted": accent.muted,
				"--project-accent-border": accent.border,
				"--project-accent-glow": accent.glow,
			} as CSSProperties)
		: baseAccentStyle;

	function handleContextMenuCapture(event: MouseEvent<HTMLElement>) {
		if (shouldUseNativeContextMenu(event.target)) {
			event.stopPropagation();
		}
	}

	return (
		<AppContextMenu>
			<div
				className="flex h-full min-h-0 flex-1 flex-row overflow-hidden bg-background text-foreground"
				style={shellStyle}
				onContextMenuCapture={handleContextMenuCapture}
			>
				<AppSidebar />

				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					<TabBar />

					<main
						className={cn(
							"flex min-h-0 flex-1 overflow-hidden bg-background",
							splitActive ? "flex-row" : "flex-col",
						)}
					>
						{splitActive ? <SplitPanes>{children}</SplitPanes> : children}
					</main>

					{!isMobile && !hidePromptBar && <GlobalPromptBar />}

					{isMobile && !inSession && (
						<div
							className={cn(
								"flex items-stretch gap-2 border-t border-border bg-chrome px-2 py-1.5",
								reading &&
									"fixed inset-x-0 bottom-0 z-[60] pb-[calc(0.375rem+env(safe-area-inset-bottom))]",
							)}
						>
							<MobilePromptBar />
							<MobileExecutionShortcut />
						</div>
					)}

					{(!isMobile || !inTerminalConversation) && <StatusBar />}
				</div>

				<DocSessionSwitcher />
				<GlobalProjectSelectDialog />
				<NavActionDialogs />
			</div>
		</AppContextMenu>
	);
}
