import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/client";
import type { TaskComplexity } from "@/constants/complexity";
import { errorMessage } from "@/lib/orpc-errors";

type CreateTaskInput = {
	projectId: string;
	title: string;
	description?: string;
	categoryId?: string;
	priorityId?: string;
	complexity: TaskComplexity;
	groupId?: string;
};

export function useCreateTask(onSuccess?: () => void) {
	const queryClient = useQueryClient();

	const { mutateAsync, isPending } = useMutation({
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
		onError: (error) => toast.error(errorMessage(error, "Não foi possível criar a tarefa")),
	});

	return {
		createTask: (input: CreateTaskInput) => mutateAsync(input),
		loading: isPending,
	};
}
