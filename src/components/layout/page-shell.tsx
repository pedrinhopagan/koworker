import { ArrowLeft, type LucideIcon } from "lucide-react";
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
	onBack?: () => void;
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
	onBack,
}: PageShellProps) {
	const isGrid = variant === "grid";

	return (
		<div className="flex flex-col min-h-0 w-full h-full overflow-hidden">
			{header && <>{header}</>}
			{!header && (
				<div
					className={cn(
						"mb-6 px-4 flex flex-wrap items-center justify-between gap-4 border-b border-border py-3",
						headerClassName,
					)}
				>
					<div className="flex items-center gap-3 ">
						{onBack && (
							<button
								type="button"
								onClick={onBack}
								aria-label="Voltar"
								className="flex size-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							>
								<ArrowLeft className="size-4" />
							</button>
						)}
						{icon && <Icon icon={icon} color="var(--project-accent, var(--primary))" size="md" />}
						<div className="">
							<Title size="lg" className="uppercase tracking-[0.12em]">
								{title}
							</Title>
							{description && (
								<Text size="xs" tone="muted">
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
