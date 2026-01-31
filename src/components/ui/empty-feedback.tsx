import { Link } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/utils";

export type EmptyFeedbackProps = {
	icon: LucideIcon;
	title: string;
	subtitle?: string;
	href?: string;
	hrefText?: string;
	className?: string;
	iconClassName?: string;
};

export const EmptyFeedback = memo(function EmptyFeedback({
	icon: Icon,
	title,
	subtitle,
	href,
	hrefText,
	className,
	iconClassName,
}: EmptyFeedbackProps) {
	return (
		<div className={cn("flex flex-col items-center justify-center py-8 text-center", className)}>
			<div className="p-3 bg-secondary/30 mb-3">
				<Icon className={cn("size-5 text-muted-foreground", iconClassName)} />
			</div>
			<p className="text-foreground text-sm font-medium mb-1">{title}</p>
			{subtitle && <p className="text-muted-foreground text-xs mb-2">{subtitle}</p>}
			{href && hrefText && (
				<Link
					to={href}
					className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
				>
					{hrefText}
					<ChevronRight className="size-3" />
				</Link>
			)}
		</div>
	);
});
