import type { ReactNode } from "react";

import { AccentStripe, ProjectFocusBar } from "@/components/layout/project-focus-bar";
import { TabBar } from "@/components/layout/tab-bar";

type AppShellProps = {
	children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
	return (
		<div className="flex-1 flex bg-background text-foreground overflow-hidden">
			{/* Accent stripe - shows selected project color */}
			<AccentStripe />

			<div className="flex flex-col flex-1 min-h-0">
				{/* Tab navigation */}
				<TabBar />

				{/* Project focus bar */}
				<div className="flex items-center justify-start border-b border-border px-3 py-2 bg-muted/30">
					<ProjectFocusBar />
				</div>

				{/* Main content */}
				<main className="flex-1 flex flex-col overflow-hidden min-h-0">{children}</main>
			</div>
		</div>
	);
}
