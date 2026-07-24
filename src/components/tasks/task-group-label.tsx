import { Text } from "@/components/typography";
import { cn } from "@/lib/utils";

export function TaskGroupLabel({
	name,
	color,
	count,
	className,
}: {
	name?: string;
	color?: string;
	count: number;
	className?: string;
}) {
	return (
		<div
			className={cn("flex min-w-0 items-center gap-2 border-b border-border/60 pb-1", className)}
		>
			{color && (
				<span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
			)}
			<Text size="sm" className={cn("truncate font-medium", !name && "text-muted-foreground")}>
				{name ?? "Sem feature"}
			</Text>
			<Text size="xs" tone="muted" className="shrink-0 tabular-nums">
				{count}
			</Text>
		</div>
	);
}
