import type { ReactNode } from "react";

export function ShellWorkspace({ rail, children }: { rail: ReactNode; children: ReactNode }) {
	return (
		<div data-component="shell-workspace" className="flex min-h-0 flex-1 bg-background">
			<div className="hidden min-h-0 shrink-0 md:flex">{rail}</div>
			<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
		</div>
	);
}
