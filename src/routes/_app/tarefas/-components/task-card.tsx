import { tv } from "tailwind-variants";

import { Title } from "@/components/typography";
import type { TaskWithMeta } from "@/types/tasks";

type TaskCardProps = {
	task: TaskWithMeta;
};

const statusColors: Record<string, string> = {
	pending: "bg-muted text-muted-foreground",
	in_execution: "bg-warning/20 text-warning",
	executed: "bg-success/20 text-success",
};

const cardVariants = tv({
	base: "flex items-center justify-between gap-4 rounded-md border border-border bg-card px-4 py-3 transition hover:border-muted-foreground/40",
});

export function TaskCard({ task }: TaskCardProps) {
	return (
		<div className={cardVariants()}>
			<div className="flex flex-1 items-center gap-3">
				<input
					type="checkbox"
					checked={task.status === "executed"}
					readOnly
					className="size-4 rounded border-border"
				/>
				<Title size="sm" as="span" className="font-normal">
					{task.title}
				</Title>
			</div>

			<div className="flex items-center gap-2">
				<span className={`rounded px-2 py-0.5 text-xs ${statusColors[task.status]}`}>
					{task.statusLabel}
				</span>

				<span
					className="rounded px-2 py-0.5 text-xs"
					style={{
						backgroundColor: `${task.category.color}20`,
						color: task.category.color,
					}}
				>
					{task.category.name}
				</span>

				<span
					className="rounded px-2 py-0.5 text-xs"
					style={{
						backgroundColor: `${task.priority.color}20`,
						color: task.priority.color,
					}}
				>
					{task.priority.name}
				</span>
			</div>
		</div>
	);
}
