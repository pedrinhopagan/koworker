import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { orpc } from "@/client";
import { CategorySelect, PrioritySelect } from "@/components/tasks";
import { StatusSelect } from "@/components/tasks/StatusSelect";
import { Text } from "@/components/typography";
import { deriveTaskItemVisualState } from "@/domain/tasks/task-item-visual-state";
import type { TaskFull } from "@/types/tasks";

type TaskDetailsProps = {
	task: NonNullable<TaskFull>;
};

export function TaskDetails({ task }: TaskDetailsProps) {
	const queryClient = useQueryClient();

	const updateMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
		},
	});

	function handleCategoryChange(categoryId: string) {
		updateMutation.mutate({ id: task.id, categoryId });
	}

	function handlePriorityChange(priorityId: string) {
		updateMutation.mutate({ id: task.id, priorityId });
	}

	const currentVisualState = useMemo(
		() =>
			deriveTaskItemVisualState({
				status: task.status,
				description: task.description,
				aiMetadata: task.aiMetadata as { lastCompletedAction?: string | null } | null,
				subtasks: task.subtasks,
				acceptanceCriteria: task.acceptanceCriteria,
				completedAt: task.completedAt ?? null,
			}),
		[
			task.status,
			task.description,
			task.aiMetadata,
			task.subtasks,
			task.acceptanceCriteria,
			task.completedAt,
		],
	);

	return (
		<div className="space-y-2 pt-2">
			<Text size="xs" tone="muted" className="uppercase tracking-wide">
				Detalhes da Task
			</Text>
			<div className="grid grid-cols-3 gap-3">
				<StatusSelect
					taskId={task.id}
					currentState={currentVisualState}
					disabled={updateMutation.isPending}
					triggerClassName="w-full"
					upperLabel
				/>
				<CategorySelect
					value={task.categoryId}
					disabled={updateMutation.isPending}
					onValueChange={handleCategoryChange}
					triggerClassName="w-full"
					upperLabel
				/>
				<PrioritySelect
					value={task.priorityId}
					disabled={updateMutation.isPending}
					onValueChange={handlePriorityChange}
					triggerClassName="w-full"
					upperLabel
				/>
			</div>
		</div>
	);
}
