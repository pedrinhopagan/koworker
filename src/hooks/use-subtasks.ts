import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { orpc, type RouterOutputs } from "@/client";

export type Subtask = NonNullable<RouterOutputs["subtasks"]["listByTask"]>[number];

export function useSubtasks(taskId: string) {
	const queryClient = useQueryClient();

	const queryOptions = orpc.subtasks.listByTask.queryOptions({ input: { taskId } });

	const { data: subtasks = [], isLoading } = useQuery(queryOptions);

	const invalidate = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
	}, [queryClient, queryOptions.queryKey]);

	const createMutation = useMutation({
		...orpc.subtasks.create.mutationOptions(),
		onSuccess: invalidate,
	});

	const updateMutation = useMutation({
		...orpc.subtasks.update.mutationOptions(),
		onSuccess: invalidate,
	});

	const removeMutation = useMutation({
		...orpc.subtasks.remove.mutationOptions(),
		onSuccess: invalidate,
	});

	const add = useCallback(
		(title: string) => {
			createMutation.mutate({ taskId, title });
		},
		[createMutation, taskId],
	);

	const toggle = useCallback(
		(id: string) => {
			const subtask = subtasks.find((s) => s.id === id);
			if (!subtask) return;

			const newStatus = subtask.status === "executed" ? "pending" : "executed";
			const completedAt = newStatus === "executed" ? Date.now() : null;

			updateMutation.mutate({ id, status: newStatus, completedAt });
		},
		[subtasks, updateMutation],
	);

	const remove = useCallback(
		(id: string) => {
			removeMutation.mutate({ id });
		},
		[removeMutation],
	);

	const update = useCallback(
		(id: string, data: Partial<Pick<Subtask, "title" | "description" | "status">>) => {
			updateMutation.mutate({ id, ...data });
		},
		[updateMutation],
	);

	const reorder = useCallback(
		(reorderedSubtasks: Subtask[]) => {
			// Optimistic update
			queryClient.setQueryData(queryOptions.queryKey, reorderedSubtasks);

			// No backend support for order field yet - just keep optimistic update
			// When order field is added to DB, uncomment below:
			// reorderedSubtasks.forEach((subtask, index) => {
			//   updateMutation.mutate({ id: subtask.id, order: index });
			// });
		},
		[queryClient, queryOptions.queryKey],
	);

	return {
		subtasks,
		isLoading,
		add,
		toggle,
		remove,
		update,
		reorder,
	};
}
