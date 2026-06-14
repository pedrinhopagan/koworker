import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/client";
import type { AgentSource } from "@/types/agents";

// Caminhos extras de agent cadastrados pelo usuário. Mexer neles muda quais agents aparecem,
// então as mutations invalidam tanto a própria lista quanto `agents.list`/`agents.get`.
export function useAgentPaths() {
	const queryClient = useQueryClient();
	const query = useQuery(orpc.agents.listPaths.queryOptions());

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: orpc.agents.listPaths.key() });
		queryClient.invalidateQueries({ queryKey: orpc.agents.list.key() });
		queryClient.invalidateQueries({ queryKey: orpc.agents.get.key() });
	};

	const addMutation = useMutation({
		...orpc.agents.addPath.mutationOptions(),
		onSuccess: () => {
			invalidate();
			toast.success("Caminho adicionado");
		},
		onError: (error: Error) => toast.error(`Erro ao adicionar caminho: ${error.message}`),
	});

	const removeMutation = useMutation({
		...orpc.agents.removePath.mutationOptions(),
		onSuccess: () => {
			invalidate();
			toast.success("Caminho removido");
		},
		onError: (error: Error) => toast.error(`Erro ao remover caminho: ${error.message}`),
	});

	return {
		paths: query.data ?? [],
		loading: query.isLoading,
		addPath: (input: { tool: AgentSource["tool"]; path: string }) => addMutation.mutate(input),
		adding: addMutation.isPending,
		removePath: (id: string) => removeMutation.mutate({ id }),
	};
}
