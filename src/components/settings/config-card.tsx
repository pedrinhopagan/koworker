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
};

export function ConfigCard({ icon, title, description, onClick, className }: ConfigCardProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"group flex w-full items-start gap-3 border border-border bg-card p-4 text-left",
				"transition-colors hover:border-primary/40 hover:bg-muted/40",
				"focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				className,
			)}
		>
			<Icon icon={icon} size="sm" className="mt-0.5" />
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
