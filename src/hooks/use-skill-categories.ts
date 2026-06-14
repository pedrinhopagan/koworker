import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/client";

export function useSkillCategoriesQuery() {
	return useQuery(orpc.skillCategories.list.queryOptions());
}

export function useSkillCategoryMutations() {
	const queryClient = useQueryClient();

	// A atribuição da skill vive em `skill_settings`, então a lista de skills também muda quando uma
	// categoria nasce ou some — ambas as queries são invalidadas em cada mutação.
	function invalidate() {
		queryClient.invalidateQueries({ queryKey: orpc.skillCategories.list.key() });
		queryClient.invalidateQueries({ queryKey: orpc.skills.list.key() });
	}

	const create = useMutation({
		...orpc.skillCategories.create.mutationOptions(),
		onSuccess: invalidate,
		onError: (error: Error) => toast.error(`Erro ao criar categoria: ${error.message}`),
	});

	const update = useMutation({
		...orpc.skillCategories.update.mutationOptions(),
		onSuccess: invalidate,
		onError: (error: Error) => toast.error(`Erro ao renomear categoria: ${error.message}`),
	});

	const remove = useMutation({
		...orpc.skillCategories.delete.mutationOptions(),
		onSuccess: invalidate,
		onError: (error: Error) => toast.error(`Erro ao remover categoria: ${error.message}`),
	});

	return { create, update, remove };
}
