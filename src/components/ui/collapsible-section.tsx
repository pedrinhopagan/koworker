import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { Text, Title } from "@/components/typography";
import { cn } from "@/lib/utils";

type CollapsibleSectionProps = {
	title: string;
	subtitle?: ReactNode;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	actions?: ReactNode;
	className?: string;
	contentClassName?: string;
	children?: ReactNode;
};

export function CollapsibleSection({
	title,
	subtitle,
	open,
	onOpenChange,
	actions,
	className,
	contentClassName,
	children,
}: CollapsibleSectionProps) {
	return (
		<div className={cn("rounded-md border bg-background", className)}>
			<div className="flex items-center justify-between gap-3 px-3 py-2">
				<button
					type="button"
					onClick={() => onOpenChange(!open)}
					className="flex min-w-0 flex-1 items-center gap-2 text-left"
				>
					<Title as="h3" size="sm" className="truncate">
						{title}
					</Title>
					{subtitle && (
						<Text size="xs" tone="muted" className="truncate">
							{subtitle}
						</Text>
					)}
				</button>

				<div className="flex items-center gap-2">
					{actions}
					<button
						type="button"
						onClick={() => onOpenChange(!open)}
						className="flex h-7 w-7 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground"
						aria-label={open ? "Recolher secao" : "Expandir secao"}
					>
						<ChevronDown className={cn("h-4 w-4", open && "rotate-180")} />
					</button>
				</div>
			</div>

			{open && (
				<div className={cn("border-t p-3", contentClassName)}>{children}</div>
			)}
		</div>
	);
}
