import { Link } from "@tanstack/react-router";
import { ChevronRight, Loader2, type LucideIcon, RotateCcw } from "lucide-react";
import { memo } from "react";

import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmptyFeedbackProps = {
	icon: LucideIcon;
	title: string;
	subtitle?: string;
	href?: string;
	hrefText?: string;
	actionText?: string;
	onAction?: () => void;
	actionPending?: boolean;
	className?: string;
	iconClassName?: string;
};

export const EmptyFeedback = memo(function EmptyFeedback({
	icon: Icon,
	title,
	subtitle,
	href,
	hrefText,
	actionText,
	onAction,
	actionPending,
	className,
	iconClassName,
}: EmptyFeedbackProps) {
	return (
		<div className={cn("flex flex-col items-center justify-center py-8 text-center", className)}>
			<div className="p-3 bg-secondary/30 mb-3">
				<Icon className={cn("size-5 text-muted-foreground", iconClassName)} />
			</div>
			<Text size="sm" className="mb-1 font-medium">
				{title}
			</Text>
			{subtitle && (
				<Text size="xs" tone="muted" className="mb-2">
					{subtitle}
				</Text>
			)}
			{actionText && onAction && (
				<Button
					variant="outline"
					size="sm"
					onClick={onAction}
					disabled={actionPending}
					aria-busy={actionPending}
					className="mb-2"
				>
					{actionPending ? (
						<Loader2 className="size-3 animate-spin" />
					) : (
						<RotateCcw className="size-3" />
					)}
					{actionText}
				</Button>
			)}
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
