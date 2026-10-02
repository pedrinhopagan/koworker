import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";

import { orpc } from "@/client";
import { errorMessage } from "@/lib/orpc-errors";
import { invalidateTaskQueries } from "@/lib/task-query-invalidation";

// Conclui/reabre uma tarefa. Compartilhado pela lista e pela página.
export function useSetDoneMutation(projectId?: string | null) {
	const queryClient = useQueryClient();

	return useMutation({
		...orpc.tasks.setDone.mutationOptions(),
		onSuccess: (_data, variables) => {
			invalidateTaskQueries(queryClient, { taskId: variables.id, projectId });
		},
		onError: (error, variables) =>
			toast.error(
				errorMessage(
					error,
					variables.done
						? "Não foi possível concluir a tarefa"
						: "Não foi possível reabrir a tarefa",
				),
			),
	});
}
