import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/client";

type CreateTaskInput = {
	projectId: string;
	title: string;
	categoryId: string;
	priorityId: string;
};

export function useCreateTask(onSuccess?: () => void) {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		...orpc.tasks.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tasks"] });
			onSuccess?.();
		},
	});

	return {
		createTask: (input: CreateTaskInput) => mutation.mutate(input),
		loading: mutation.isPending,
		error: mutation.isError,
	};
}
