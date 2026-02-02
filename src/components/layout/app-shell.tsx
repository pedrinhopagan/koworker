import type { CSSProperties, ReactNode } from "react";
import { ProjectFocusBar } from "@/components/layout/project-focus-bar";
import { TabBar } from "@/components/layout/tab-bar";
import { usePrimaryColor, useProjectFocus, useUser } from "@/hooks";

type AppShellProps = {
	children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
	useUser();
	usePrimaryColor();
	const { accent } = useProjectFocus();

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

	const focusBarStyle = accent
		? {
				backgroundImage: `linear-gradient(90deg, ${accent.soft} 0%, transparent 70%)`,
				// borderBottomColor: accent.border,
				boxShadow: `inset 0 -1px 0 ${accent.border}`,
			}
		: undefined;

	const mainStyle = accent
		? {
				boxShadow: `inset 0 0 0px ${accent.glow}`,
				backgroundImage: `linear-gradient(120deg, ${accent.soft} 0%, transparent 100%)`,
			}
		: undefined;

	return (
		<div
			className="flex-1 flex bg-background text-foreground overflow-hidden h-screen"
			style={shellStyle}
		>
			{/*<AccentStripe />*/}

			<div className="flex flex-col flex-1 min-h-0">
				<TabBar />

				<div
					className="flex items-center justify-start border-b border-border px-3 py-2 bg-muted/30"
					style={focusBarStyle}
				>
					<ProjectFocusBar />
				</div>

				<main
					className="flex-1 flex flex-col overflow-hidden min-h-0 bg-background"
					style={mainStyle}
				>
					{children}
				</main>
			</div>
		</div>
	);
}
