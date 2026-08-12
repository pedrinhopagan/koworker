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
				<div className={cn("mb-6 border-b border-border", headerClassName)}>
					<div className="mx-auto flex w-full max-w-6xl flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
						<div className="flex min-w-0 items-center gap-3">
							{onBack && (
								<button
									type="button"
									onClick={onBack}
									aria-label="Voltar"
									className="flex size-8 cursor-pointer items-center justify-center border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
								>
									<ArrowLeft className="size-4" />
								</button>
							)}
							{icon && <Icon icon={icon} color="var(--project-accent, var(--primary))" size="md" />}
							<div className="min-w-0">
								<Title size="lg" className="truncate uppercase tracking-[0.12em]">
									{title}
								</Title>
								{description && (
									<Text size="xs" tone="muted">
										{description}
									</Text>
								)}
							</div>
						</div>
						{actions && (
							<div className="flex w-full items-center gap-2 overflow-x-auto pb-0.5 sm:w-auto sm:overflow-visible sm:pb-0">
								{actions}
							</div>
						)}
					</div>
				</div>
			)}
			<div
				className={cn(
					"mx-auto w-full max-w-6xl",
					isGrid
						? "flex min-h-0 flex-1 flex-col-reverse gap-6 md:grid md:grid-cols-[2fr_3fr] *:min-w-0"
						: "min-h-0 flex-1 px-4",
					contentClassName,
				)}
			>
				{children}
			</div>
		</div>
	);
}
