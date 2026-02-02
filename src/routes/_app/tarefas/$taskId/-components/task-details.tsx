import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/client";
import { CategorySelect, PrioritySelect } from "@/components/tasks";
import { Text } from "@/components/typography";
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

	return (
		<div className="space-y-2 pt-2">
			<Text size="xs" tone="muted" className="uppercase tracking-wide">
				Detalhes da Task
			</Text>
			<div className="grid grid-cols-2 gap-3">
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
