import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";

import { Text } from "@/components/typography";
import { COMPLEXITY_COLORS, COMPLEXITY_LABELS } from "@/constants/complexity";
import { cn } from "@/lib/utils";
import type { TaskWithMeta } from "@/types/tasks";

// Linha enxuta do backlog: ponto de prioridade + título truncado em uma linha. É a fonte do DnD
// (arrastar pro dia agenda a tarefa) — diferente do TaskItem cheio da lista de Tarefas, que não
// cabe na coluna estreita da sidebar.
export function AgendaBacklogTask({ task }: { task: TaskWithMeta }) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: `task:${task.id}`,
		data: { type: "task", task },
	});

	return (
		<button
			ref={setNodeRef}
			type="button"
			{...attributes}
			{...listeners}
			title={task.displayTitle}
			className={cn(
				"flex w-full min-w-0 cursor-grab items-center gap-2 border border-transparent bg-card px-2 py-1.5 text-left transition-colors hover:border-border hover:bg-secondary/30",
				isDragging && "opacity-40",
			)}
		>
			<GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
			<span
				className="size-2 shrink-0 rounded-full"
				style={{ backgroundColor: task.priority?.color ?? COMPLEXITY_COLORS[task.complexity] }}
				title={task.priority?.name ?? COMPLEXITY_LABELS[task.complexity]}
			/>
			<Text as="span" size="sm" className="min-w-0 flex-1 truncate">
				{task.displayTitle}
			</Text>
		</button>
	);
}
