import type { LucideIcon } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type ConfigCardProps = {
	icon: LucideIcon;
	title: string;
	description: string;
	onClick: () => void;
	className?: string;
	iconClassName?: string;
	disabled?: boolean;
};

export function ConfigCard({
	icon,
	title,
	description,
	onClick,
	className,
	iconClassName,
	disabled,
}: ConfigCardProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"group flex w-full items-start gap-3 border border-border bg-card p-4 text-left",
				"transition-colors hover:border-primary/40 hover:bg-muted/40",
				"focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				"disabled:pointer-events-none disabled:opacity-70",
				className,
			)}
		>
			<Icon icon={icon} size="sm" className={cn("mt-0.5", iconClassName)} />
			<div className="space-y-1">
				<Title as="h3" size="sm" className="text-sm font-semibold">
					{title}
				</Title>
				<Text size="sm" tone="muted">
					{description}
				</Text>
			</div>
		</button>
	);
}
