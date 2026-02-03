import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/client";
import type {
	CreateRouteInput,
	UpdateRouteInput,
	DeleteRouteInput,
	ReorderRoutesInput,
} from "./types";

type UseProjectRoutesProps = {
	onSuccess?: () => void;
};

export function useProjectRoutes({ onSuccess }: UseProjectRoutesProps = {}) {
	const createMutation = useMutation({
		...orpc.projectRoutes.create.mutationOptions(),
		onSuccess: () => {
			toast.success("Rota criada com sucesso");
			onSuccess?.();
		},
		onError: (error) => {
			toast.error(`Erro ao criar rota: ${error.message || "Erro desconhecido"}`);
		},
	});

	const updateMutation = useMutation({
		...orpc.projectRoutes.update.mutationOptions(),
		onSuccess: () => {
			onSuccess?.();
		},
		onError: (error) => {
			toast.error(`Erro ao atualizar rota: ${error.message || "Erro desconhecido"}`);
		},
	});

	const deleteMutation = useMutation({
		...orpc.projectRoutes.delete.mutationOptions(),
		onSuccess: () => {
			toast.success("Rota removida com sucesso");
			onSuccess?.();
		},
		onError: (error) => {
			toast.error(`Erro ao remover rota: ${error.message || "Erro desconhecido"}`);
		},
	});

	const reorderMutation = useMutation({
		...orpc.projectRoutes.reorder.mutationOptions(),
		onSuccess: () => {
			onSuccess?.();
		},
		onError: (error) => {
			toast.error(`Erro ao reordenar rotas: ${error.message || "Erro desconhecido"}`);
		},
	});

	return {
		createRoute: (input: CreateRouteInput) => createMutation.mutate(input),
		updateRoute: (input: UpdateRouteInput) => updateMutation.mutate(input),
		deleteRoute: (input: DeleteRouteInput) => deleteMutation.mutate(input),
		reorderRoutes: (input: ReorderRoutesInput) => reorderMutation.mutate(input),
		isCreating: createMutation.isPending,
		isUpdating: updateMutation.isPending,
		isDeleting: deleteMutation.isPending,
		isReordering: reorderMutation.isPending,
		isLoading:
			createMutation.isPending ||
			updateMutation.isPending ||
			deleteMutation.isPending ||
			reorderMutation.isPending,
	};
}
