import { useRouterState } from "@tanstack/react-router";
import type {
	CSSProperties,
	MouseEvent as ReactMouseEvent,
	PointerEvent as ReactPointerEvent,
	ReactNode,
} from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AppContextMenu } from "@/components/layout/app-context-menu";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Divider } from "@/components/layout/divider";
import { DocSessionSwitcher } from "@/components/doc-session-switcher";
import { NavActionDialogs } from "@/components/layout/nav-action-dialogs";
import { PinnedPane } from "@/components/layout/pinned-pane";
import { GlobalProjectSelectDialog } from "@/components/layout/project-select-dialog";
import { StatusBar } from "@/components/layout/status-bar";
import { TabBar } from "@/components/layout/tab-bar";
import { GlobalPromptBar } from "@/components/prompt-bar/global-prompt-bar";
import { MobilePromptBar } from "@/components/prompt-bar/mobile-prompt-bar";
import { MobileExecutionShortcut } from "@/components/layout/mobile-execution-shortcut";
import { useDivider } from "@/hooks/use-divider";
import { useIsMobileViewport, usePrimaryColor, useProjectFocus, useUser } from "@/hooks";
import {
	clampSplitPaneWidth,
	isShellsPath,
	SHELL_PANE_WIDTH_PROPERTY,
	shellPaneWidthValue,
	SPLIT_MAIN_MIN,
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

const PULSE_FLASH_MS = 700;

export function SplitPanes({ children }: AppShellProps) {
	const storedWidth = useSplitViewStore((state) => state.width);
	const setWidth = useSplitViewStore((state) => state.setWidth);
	const setResizing = useSplitViewStore((state) => state.setResizing);
	const close = useSplitViewStore((state) => state.close);
	const pulse = useSplitViewStore((state) => state.pulse);

	const rowRef = useRef<HTMLDivElement | null>(null);
	const [rowWidth, setRowWidth] = useState<number>();
	const [flash, setFlash] = useState(false);

	const maxPaneWidth =
		rowWidth === undefined
			? Number.POSITIVE_INFINITY
			: Math.max(SPLIT_PANE_MIN, rowWidth - SPLIT_MAIN_MIN);
	const paneWidth =
		rowWidth === undefined
			? Math.max(storedWidth, SPLIT_PANE_MIN)
			: clampSplitPaneWidth(storedWidth, rowWidth);

	const attachRow = useCallback((element: HTMLDivElement | null) => {
		rowRef.current = element;
		if (!element) {
			return;
		}

		element.style.setProperty(
			SHELL_PANE_WIDTH_PROPERTY,
			`${clampSplitPaneWidth(useSplitViewStore.getState().width, element.clientWidth)}px`,
		);
		setRowWidth(element.clientWidth);
		const observer = new ResizeObserver(() => setRowWidth(element.clientWidth));
		observer.observe(element);

		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (rowWidth === undefined) {
			return;
		}

		const stored = useSplitViewStore.getState().width;
		const max = Math.max(SPLIT_PANE_MIN, rowWidth - SPLIT_MAIN_MIN);
		if (stored > max) {
			setWidth(max);
			rowRef.current?.style.setProperty(SHELL_PANE_WIDTH_PROPERTY, `${max}px`);
		}
	}, [rowWidth, setWidth]);

	useEffect(() => {
		if (!pulse) {
			return;
		}

		setFlash(true);
		const timer = setTimeout(() => setFlash(false), PULSE_FLASH_MS);
		return () => clearTimeout(timer);
	}, [pulse]);

	const divider = useDivider({
		value: paneWidth,
		min: SPLIT_PANE_MIN,
		max: maxPaneWidth,
		sign: 1,
		target: rowRef,
		resolve: (proposed) => {
			const width = clampSplitPaneWidth(proposed, rowWidth ?? Number.POSITIVE_INFINITY);
			return {
				vars: [{ property: SHELL_PANE_WIDTH_PROPERTY, value: width }],
				commit: () => {
					setWidth(width);
					setResizing(false);
				},
			};
		},
	});

	const shellDivider = {
		...divider,
		pointerProps: {
			...divider.pointerProps,
			onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
				divider.pointerProps.onPointerDown(event);
				setResizing(true);
			},
		},
	};

	return (
		<div
			ref={attachRow}
			className={cn(
				"relative flex min-h-0 min-w-0 flex-1",
				shellDivider.resizing && "cursor-col-resize select-none",
			)}
		>
			<div
				data-component="split-pane-shell"
				className={cn(
					"relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden bg-background ring-primary/50 transition-shadow duration-300",
					flash && "ring-[3px] ring-inset",
				)}
				style={{ width: shellPaneWidthValue() }}
			>
				<PinnedPane />
			</div>

			<div className="group relative w-px shrink-0">
				<Divider control={shellDivider} side="left" label="Redimensionar painel fixado" />
				<button
					type="button"
					onClick={close}
					aria-label="Desafixar"
					className="absolute top-2 left-1/2 z-20 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-chrome text-muted-foreground opacity-0 shadow-xs transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
				>
					<X className="size-3.5" />
				</button>
			</div>

			<div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
		</div>
	);
}

export function AppShell({ children }: AppShellProps) {
	useUser();
	usePrimaryColor();
	const { accent } = useProjectFocus();
	const isMobile = useIsMobileViewport();
	const reading = useReadingModeStore((s) => s.reading);

	const pinnedPath = useSplitViewStore((s) => s.path);
	const splitActive = !isMobile && !!pinnedPath;
	const inSession = useRouterState({
		select: (state) => {
			const pathname = state.location.pathname;
			return pathname === "/shells" || pathname.startsWith("/shells/");
		},
	});
	const inTerminalConversation = useRouterState({
		select: (state) => {
			const pathname = state.location.pathname;
			return pathname === "/shells" || pathname.startsWith("/shells/");
		},
	});

	const shellPinned = !!pinnedPath && isShellsPath(pinnedPath);
	const hidePromptBar = inSession || shellPinned;

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

	function handleContextMenuCapture(event: ReactMouseEvent<HTMLElement>) {
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
							"flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background",
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
