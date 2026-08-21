import { useRouterState } from "@tanstack/react-router";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { AppContextMenu } from "@/components/layout/app-context-menu";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DocSessionSwitcher } from "@/components/doc-session-switcher";
import { NavActionDialogs } from "@/components/layout/nav-action-dialogs";
import { GlobalProjectSelectDialog } from "@/components/layout/project-select-dialog";
import { StatusBar } from "@/components/layout/status-bar";
import { TabBar } from "@/components/layout/tab-bar";
import { GlobalPromptBar } from "@/components/prompt-bar/global-prompt-bar";
import { MobilePromptBar } from "@/components/prompt-bar/mobile-prompt-bar";
import { MobileExecutionShortcut } from "@/components/layout/mobile-execution-shortcut";
import { useIsMobileViewport, usePrimaryColor, useProjectFocus, useUser } from "@/hooks";
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
			'input, textarea, select, [contenteditable="true"], [contenteditable=""], .cm-editor',
		)
	);
}

export function AppShell({ children }: AppShellProps) {
	useUser();
	usePrimaryColor();
	const { accent } = useProjectFocus();
	const isMobile = useIsMobileViewport();
	const reading = useReadingModeStore((s) => s.reading);
	const inSession = useRouterState({
		select: (state) => state.location.pathname.startsWith("/terminals"),
	});

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

					<main className="flex-1 flex flex-col overflow-hidden min-h-0 bg-background">
						{children}
					</main>

					{!isMobile && !inSession && <GlobalPromptBar />}

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

					<StatusBar />
				</div>

				<DocSessionSwitcher />
				<GlobalProjectSelectDialog />
				<NavActionDialogs />
			</div>
		</AppContextMenu>
	);
}
