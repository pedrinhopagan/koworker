import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/client";

type CreateTaskInput = {
	projectId: string;
	title: string;
	description?: string;
	categoryId: string;
	priorityId: string;
};

export function useCreateTask(onSuccess?: () => void) {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		...orpc.tasks.create.mutationOptions(),
		onSuccess: async () => {
			// ORPC TanStack Query keys are shaped like:
			// [ ["tasks", "listByProject"], { type: "query", input: {...} } ]
			// So invalidating with queryKey: ["tasks"] won't match.
			await queryClient.invalidateQueries({
				predicate: (query) => Array.isArray(query.queryKey[0]) && query.queryKey[0][0] === "tasks",
			});
			onSuccess?.();
		},
	});

	return {
		createTask: (input: CreateTaskInput) => mutation.mutate(input),
		loading: mutation.isPending,
		error: mutation.isError,
	};
}
