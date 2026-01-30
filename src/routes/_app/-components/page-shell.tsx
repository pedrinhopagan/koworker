import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { Icon } from "@/components/ui/icon";

type PageShellProps = {
	title: string;
	description?: string;
	actions?: ReactNode;
	icon?: LucideIcon;
	children: ReactNode;
};

export function PageShell({ title, description, actions, icon, children }: PageShellProps) {
	const headerStyle = {
		borderBottomColor: "var(--project-accent-border, var(--border))",
		boxShadow: "inset 0 -1px 0 var(--project-accent-border, var(--border))",
		backgroundImage:
			"linear-gradient(90deg, var(--project-accent-soft, transparent) 0%, transparent 70%)",
	};

	return (
		<div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4 py-4 min-h-0">
			<div
				className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3"
				style={headerStyle}
			>
				<div className="flex items-center gap-3">
					{icon && <Icon icon={icon} color="var(--project-accent, var(--primary))" size="md" />}
					<div className="space-y-1">
						<Title size="md">{title}</Title>
						{description && (
							<Text size="sm" tone="muted">
								{description}
							</Text>
						)}
					</div>
				</div>
				{actions && <div className="flex items-center gap-2">{actions}</div>}
			</div>
			<div className="min-h-0 flex-1">{children}</div>
		</div>
	);
}
