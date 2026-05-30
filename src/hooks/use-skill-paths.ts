import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/client";
import type { SkillSource } from "@/types/skills";

// Caminhos extras de skill cadastrados pelo usuário. Mexer neles muda quais skills aparecem,
// então as mutations invalidam tanto a própria lista quanto `skills.list`/`skills.get`.
export function useSkillPaths() {
	const queryClient = useQueryClient();
	const query = useQuery(orpc.skills.listPaths.queryOptions());

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: orpc.skills.listPaths.key() });
		queryClient.invalidateQueries({ queryKey: orpc.skills.list.key() });
		queryClient.invalidateQueries({ queryKey: orpc.skills.get.key() });
	};

	const addMutation = useMutation({
		...orpc.skills.addPath.mutationOptions(),
		onSuccess: () => {
			invalidate();
			toast.success("Caminho adicionado");
		},
		onError: (error: Error) => toast.error(`Erro ao adicionar caminho: ${error.message}`),
	});

	const removeMutation = useMutation({
		...orpc.skills.removePath.mutationOptions(),
		onSuccess: () => {
			invalidate();
			toast.success("Caminho removido");
		},
		onError: (error: Error) => toast.error(`Erro ao remover caminho: ${error.message}`),
	});

	return {
		paths: query.data ?? [],
		loading: query.isLoading,
		addPath: (input: { tool: SkillSource["tool"]; path: string }) => addMutation.mutate(input),
		adding: addMutation.isPending,
		removePath: (id: string) => removeMutation.mutate({ id }),
	};
}
