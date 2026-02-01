import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { Text, Title } from "@/components/typography";
import { cn } from "@/lib/utils";

const collapsibleSectionVariants = tv({
	slots: {
		root: "",
		header: "flex items-center justify-between gap-3 w-full hover:bg-muted/50 cursor-pointer",
		trigger: "flex min-w-0 flex-1 items-center gap-2 text-left  p-2 ",
		actions: "flex items-center gap-2",
		chevron: "flex items-center justify-center text-muted-foreground transition-colors",
		content: "",
	},
	variants: {
		variant: {
			default: {
				root: "rounded-md border bg-background",
				header: "px-3 py-2",
				chevron: "h-7 w-7 rounded-md border bg-muted/40",
				content: "border-t p-3",
			},
			compact: {
				root: "bg-transparent",
				chevron: "h-5 w-5",
				content: "mt-2",
			},
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

type CollapsibleSectionProps = {
	title: string;
	subtitle?: ReactNode;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	actions?: ReactNode;
	className?: string;
	contentClassName?: string;
	titleClassName?: string;
	subtitleClassName?: string;
	children?: ReactNode;
	variant?: VariantProps<typeof collapsibleSectionVariants>["variant"];
};

export function CollapsibleSection({
	title,
	subtitle,
	open,
	onOpenChange,
	actions,
	className,
	contentClassName,
	titleClassName,
	subtitleClassName,
	children,
	variant = "default",
}: CollapsibleSectionProps) {
	const titleSize = variant === "compact" ? "sm" : "lg";

	const styles = collapsibleSectionVariants({ variant });
	return (
		<div className={cn(styles.root(), className)}>
			<button type="button" onClick={() => onOpenChange(!open)} className={styles.header()}>
				<div className={styles.trigger()}>
					<Title as="h3" size={titleSize} className={cn("truncate", titleClassName)}>
						{title}
					</Title>
					{subtitle && (
						<Text size="xs" tone="muted" className={cn("truncate", subtitleClassName)}>
							{subtitle}
						</Text>
					)}
				</div>

				<div className={styles.actions()}>
					{actions}
					<div className={styles.chevron()} aria-label={open ? "Recolher secao" : "Expandir secao"}>
						<ChevronDown className={cn("h-4 w-4", open && "rotate-180")} />
					</div>
				</div>
			</button>

			{open && <div className={cn(styles.content(), contentClassName)}>{children}</div>}
		</div>
	);
}
