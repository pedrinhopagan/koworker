import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Text, Title } from "@/components/typography";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type PageShellProps = {
	title: string;
	description?: string;
	actions?: ReactNode;
	icon?: LucideIcon;
	children: ReactNode;
	variant?: "default" | "grid";
	header?: ReactNode;
	contentClassName?: string;
	headerClassName?: string;
};

export function PageShell({
	title,
	description,
	actions,
	icon,
	children,
	variant,
	header,
	contentClassName,
	headerClassName,
}: PageShellProps) {
	const isGrid = variant === "grid";

	return (
		<div className="flex flex-col min-h-0 py-2 w-full h-full overflow-hidden">
			{header && <>{header}</>}
			{!header && (
				<div
					className={cn(
						"mb-4 px-4 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3",
						headerClassName,
					)}
				>
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
			)}
			<div
				className={cn(
					isGrid
						? "flex flex-col-reverse gap-6 h-full min-h-0 md:grid md:grid-cols-[2fr_3fr] *:min-w-0"
						: "min-h-0 flex-1 px-4",
					contentClassName,
				)}
			>
				{children}
			</div>
		</div>
	);
}
