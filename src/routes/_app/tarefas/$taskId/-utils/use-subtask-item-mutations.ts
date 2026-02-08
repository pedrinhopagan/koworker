import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/client";

import { invalidateSubtasksQueries } from "./invalidate-subtasks-queries";

export function useSubtaskItemMutations() {
	const queryClient = useQueryClient();

	const updateMutation = useMutation({
		...orpc.subtasks.update.mutationOptions(),
		onSuccess: () => {
			invalidateSubtasksQueries(queryClient);
		},
	});

	const removeMutation = useMutation({
		...orpc.subtasks.remove.mutationOptions(),
		onSuccess: () => {
			invalidateSubtasksQueries(queryClient);
		},
	});

	return {
		updateMutation,
		removeMutation,
		isMutating: updateMutation.isPending || removeMutation.isPending,
	};
}
