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

	const reorderMutation = useMutation({
		...orpc.subtasks.reorder.mutationOptions(),
		onMutate: async ({ orderedIds }) => {
			await queryClient.cancelQueries({ queryKey: queryOptions.queryKey });
			const previous = queryClient.getQueryData(queryOptions.queryKey) as Subtask[] | undefined;

			if (previous && previous.length > 0) {
				const byId = new Map(previous.map((subtask) => [subtask.id, subtask] as const));
				const next = orderedIds
					.map((id, index) => {
						const item = byId.get(id);
						return item ? { ...item, displayOrder: index } : null;
					})
					.filter(Boolean) as Subtask[];
				queryClient.setQueryData(queryOptions.queryKey, next);
			}

			return { previous };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.previous) queryClient.setQueryData(queryOptions.queryKey, ctx.previous);
		},
		onSettled: invalidate,
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
			reorderMutation.mutate({ orderedIds: reorderedSubtasks.map((subtask) => subtask.id) });
		},
		[reorderMutation],
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
