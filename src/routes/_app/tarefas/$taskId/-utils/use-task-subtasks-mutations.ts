import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { orpc } from "@/client";
import type { SubtaskFull, TaskFull } from "@/types/tasks";

import { invalidateSubtasksQueries } from "./invalidate-subtasks-queries";

type UseTaskSubtasksMutationsOptions = {
	taskId: string;
	taskQueryKey: QueryKey;
};

export function useTaskSubtasksMutations({
	taskId,
	taskQueryKey,
}: UseTaskSubtasksMutationsOptions) {
	const queryClient = useQueryClient();
	const invalidateTimeoutRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (invalidateTimeoutRef.current) {
				window.clearTimeout(invalidateTimeoutRef.current);
			}
		};
	}, []);

	const addMutation = useMutation({
		...orpc.subtasks.create.mutationOptions(),
		onSuccess: () => {
			invalidateSubtasksQueries(queryClient);
		},
	});

	const reorderMutation = useMutation({
		...orpc.subtasks.reorder.mutationOptions(),
		onMutate: async ({ orderedIds }) => {
			await queryClient.cancelQueries({ queryKey: taskQueryKey });
			const previous = queryClient.getQueryData(taskQueryKey) as TaskFull | undefined;

			if (previous?.subtasks) {
				const byId = new Map(previous.subtasks.map((subtask) => [subtask.id, subtask] as const));
				const nextSubtasks = orderedIds
					.map((id, index) => {
						const item = byId.get(id);
						return item ? { ...item, displayOrder: index } : null;
					})
					.filter(Boolean) as SubtaskFull[];
				queryClient.setQueryData(taskQueryKey, { ...previous, subtasks: nextSubtasks });
			}

			return { previous };
		},
		onError: (_error, _vars, ctx) => {
			if (ctx?.previous) {
				queryClient.setQueryData(taskQueryKey, ctx.previous);
			}
		},
		onSettled: () => {
			if (invalidateTimeoutRef.current) {
				window.clearTimeout(invalidateTimeoutRef.current);
			}

			invalidateTimeoutRef.current = window.setTimeout(() => {
				queryClient.invalidateQueries({ queryKey: taskQueryKey });
				invalidateSubtasksQueries(queryClient);
			}, 350);
		},
	});

	function addSubtask(title: string) {
		const trimmedTitle = title.trim();
		if (!trimmedTitle) {
			return;
		}

		addMutation.mutate({ taskId, title: trimmedTitle });
	}

	function reorderSubtasks(items: SubtaskFull[]) {
		reorderMutation.mutate({ orderedIds: items.map((item) => item.id) });
	}

	return {
		addMutation,
		reorderMutation,
		addSubtask,
		reorderSubtasks,
	};
}
