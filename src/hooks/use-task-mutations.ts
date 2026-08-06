import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/client";
import { errorMessage } from "@/lib/orpc-errors";
import { invalidateTaskQueries } from "@/lib/task-query-invalidation";

export function useUpdateTaskMutation(projectId?: string | null) {
	const queryClient = useQueryClient();

	return useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: (_data, variables) =>
			invalidateTaskQueries(queryClient, { taskId: variables.id, projectId }),
		onError: (error) =>
			toast.error(errorMessage(error, "Não foi possível salvar as alterações da tarefa")),
	});
}

export function useRemoveTaskMutation(
	projectId?: string | null,
	options?: { onRemoved?: () => void },
) {
	const queryClient = useQueryClient();

	const { mutate: restoreTask } = useMutation({
		...orpc.tasks.restore.mutationOptions(),
		onSuccess: (data) => {
			void invalidateTaskQueries(queryClient, { taskId: data.id, projectId: data.projectId });
			toast.success("Tarefa restaurada");
		},
		onError: (error) => toast.error(errorMessage(error, "Não foi possível restaurar a tarefa")),
	});

	return useMutation({
		...orpc.tasks.remove.mutationOptions(),
		onSuccess: (_data, variables) => {
			void invalidateTaskQueries(queryClient, { taskId: variables.id, projectId });
			toast.success("Tarefa excluída", {
				action: { label: "Desfazer", onClick: () => restoreTask({ id: variables.id }) },
				duration: 10_000,
			});
			options?.onRemoved?.();
		},
		onError: (error) => toast.error(errorMessage(error, "Não foi possível excluir a tarefa")),
	});
}

export function useMoveTaskToProjectMutation(projectId?: string | null) {
	const queryClient = useQueryClient();

	return useMutation({
		...orpc.tasks.moveToProject.mutationOptions(),
		onSuccess: (_data, variables) => {
			void invalidateTaskQueries(queryClient, { taskId: variables.id, projectId });
			void invalidateTaskQueries(queryClient, {
				taskId: variables.id,
				projectId: variables.targetProjectId,
			});
		},
		onError: (error) =>
			toast.error(errorMessage(error, "Não foi possível mover a tarefa de projeto")),
	});
}

export function useMoveTaskToFeatureMutation(projectId?: string | null) {
	const queryClient = useQueryClient();

	return useMutation({
		...orpc.tasks.moveToFeature.mutationOptions(),
		onSuccess: (_data, variables) =>
			invalidateTaskQueries(queryClient, { taskId: variables.id, projectId }),
		onError: (error) =>
			toast.error(errorMessage(error, "Não foi possível mover a tarefa de feature")),
	});
}
