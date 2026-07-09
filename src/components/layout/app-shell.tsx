import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { AppContextMenu } from "@/components/layout/app-context-menu";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DocSessionSwitcher } from "@/components/doc-session-switcher";
import { NavActionDialogs } from "@/components/layout/nav-action-dialogs";
import { ProjectSelectDialog } from "@/components/layout/project-select-dialog";
import { StatusBar } from "@/components/layout/status-bar";
import { TabBar } from "@/components/layout/tab-bar";
import { GlobalPromptBar } from "@/components/prompt-bar/global-prompt-bar";
import { usePrimaryColor, useProjectFocus, useUser } from "@/hooks";
import { useProjectSelectDialog } from "@/hooks/use-project-select-dialog";

type AppShellProps = {
	children: ReactNode;
};

function shouldUseNativeContextMenu(target: EventTarget | null) {
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
	const { open, closeDialog } = useProjectSelectDialog();

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
				className="flex flex-1 flex-row overflow-hidden h-dvh bg-background text-foreground"
				style={shellStyle}
				onContextMenuCapture={handleContextMenuCapture}
			>
				<AppSidebar />

				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					<TabBar />

					<main className="flex-1 flex flex-col overflow-hidden min-h-0 bg-background">
						{children}
					</main>

					<GlobalPromptBar />

					<StatusBar />
				</div>

				<DocSessionSwitcher />
				<ProjectSelectDialog open={open} onClose={closeDialog} />
				<NavActionDialogs />
			</div>
		</AppContextMenu>
	);
}
