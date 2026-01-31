import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

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
	return (
		<div className="mx-auto flex flex-col py-4 min-h-0 w-screen h-screen">
			<div className="mb-4 px-4 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
				<div className="flex items-center gap-3 ">
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
			<div className="min-h-0 flex-1 px-4">{children}</div>
		</div>
	);
}
