import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/client";

export function useAgentCategoriesQuery() {
	return useQuery(orpc.agentCategories.list.queryOptions());
}

export function useAgentCategoryMutations() {
	const queryClient = useQueryClient();

	// A atribuição do agent vive em `agent_settings`, então a lista de agents também muda quando uma
	// categoria nasce ou some — ambas as queries são invalidadas em cada mutação.
	function invalidate() {
		queryClient.invalidateQueries({
			queryKey: orpc.agentCategories.list.key(),
		});
		queryClient.invalidateQueries({ queryKey: orpc.agents.list.key() });
	}

	const create = useMutation({
		...orpc.agentCategories.create.mutationOptions(),
		onSuccess: invalidate,
		onError: (error: Error) => toast.error(`Erro ao criar categoria: ${error.message}`),
	});

	const update = useMutation({
		...orpc.agentCategories.update.mutationOptions(),
		onSuccess: invalidate,
		onError: (error: Error) => toast.error(`Erro ao renomear categoria: ${error.message}`),
	});

	const remove = useMutation({
		...orpc.agentCategories.delete.mutationOptions(),
		onSuccess: invalidate,
		onError: (error: Error) => toast.error(`Erro ao remover categoria: ${error.message}`),
	});

	return { create, update, remove };
}
