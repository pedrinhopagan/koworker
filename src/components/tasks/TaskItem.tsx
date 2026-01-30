import { tv, type VariantProps } from "tailwind-variants";

import { Badge } from "@/components/ui/badge";
import { Title } from "@/components/typography";
import { cn } from "@/lib/utils";
import type { TaskWithMeta } from "@/types/tasks";

const taskItemVariants = tv({
	base: "flex items-center justify-between gap-4 border border-transparent bg-card transition-all duration-200 hover:border-border hover:bg-secondary/30 animate-fade-in",
	variants: {
		variant: {
			default: "px-3 py-2",
			compact: "px-3 py-1.5",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

const statusVariants = {
	pending: "muted",
	in_execution: "warning",
	executed: "success",
} as const;

export type TaskItemVariant = VariantProps<typeof taskItemVariants>["variant"];

type TaskItemProps = {
	task: TaskWithMeta;
	variant?: TaskItemVariant;
};

export function TaskItem({ task, variant = "default" }: TaskItemProps) {
	const isDone = task.status === "executed";
	const statusVariant = statusVariants[task.status] ?? "muted";

	return (
		<div className={taskItemVariants({ variant })}>
			<div className="flex min-w-0 items-center gap-3">
				<span className={cn("text-muted-foreground transition-colors", isDone && "text-primary")}>
					{isDone ? "[x]" : "[ ]"}
				</span>
				<Title
					as="span"
					size="sm"
					className={cn(
						"truncate text-sm font-normal",
						isDone && "line-through text-muted-foreground",
					)}
				>
					{task.title}
				</Title>
			</div>

			<div className="flex shrink-0 items-center gap-2">
				<Badge variant={statusVariant} className="shrink-0">
					{task.statusLabel}
				</Badge>
				<Badge
					variant="muted"
					className="shrink-0"
					style={{
						backgroundColor: `${task.category.color}20`,
						color: task.category.color,
					}}
				>
					{task.category.name}
				</Badge>
				<Badge
					variant="muted"
					className="shrink-0"
					style={{
						backgroundColor: `${task.priority.color}20`,
						color: task.priority.color,
					}}
				>
					{task.priority.name}
				</Badge>
			</div>
		</div>
	);
}
