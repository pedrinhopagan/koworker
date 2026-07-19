import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/client";

export function useSkillMutations() {
	const queryClient = useQueryClient();
	const invalidateList = () => queryClient.invalidateQueries({ queryKey: orpc.skills.list.key() });
	const invalidateAll = () => {
		invalidateList();
		queryClient.invalidateQueries({ queryKey: orpc.skills.get.key() });
	};

	const updateMutation = useMutation({
		...orpc.skills.update.mutationOptions(),
		onSuccess: invalidateAll,
		onError: (error: Error) => toast.error(`Erro ao salvar skill: ${error.message}`),
	});

	const standardizeMutation = useMutation({
		...orpc.skills.standardize.mutationOptions(),
		onSuccess: (result) => {
			invalidateAll();
			const parts = [
				result.written > 0 &&
					`${result.written} ${result.written === 1 ? "cópia sobrescrita" : "cópias sobrescritas"}`,
				result.created > 0 &&
					`${result.created} ${result.created === 1 ? "cópia criada" : "cópias criadas"}`,
			].filter(Boolean);
			toast.success(
				parts.length > 0
					? `Skill replicada: ${parts.join(" e ")}`
					: "Todas as cópias já estavam iguais",
			);
		},
		onError: (error: Error) => toast.error(`Erro ao replicar: ${error.message}`),
	});

	const deleteMutation = useMutation({
		...orpc.skills.delete.mutationOptions(),
		onSuccess: () => {
			invalidateAll();
			toast.success("Cópia removida");
		},
		onError: (error: Error) => toast.error(`Erro ao remover skill: ${error.message}`),
	});

	const deleteAllMutation = useMutation({
		...orpc.skills.deleteAll.mutationOptions(),
		onSuccess: (result) => {
			invalidateAll();
			toast.success(
				`Skill removida de ${result.removed} ${result.removed === 1 ? "fonte" : "fontes"}`,
			);
		},
		onError: (error: Error) => toast.error(`Erro ao remover skill: ${error.message}`),
	});

	return {
		updateContent: (input: {
			slug: string;
			description: string;
			content: string;
			metadata: Record<string, unknown>;
		}) => updateMutation.mutateAsync(input),
		standardize: (input: { slug: string; projectName?: string; sourcePath: string }) =>
			standardizeMutation.mutate(input),
		standardizing: standardizeMutation.isPending,
		removeSkill: (path: string) => deleteMutation.mutate({ path }),
		removeAllSkill: (input: { slug: string; projectName?: string }) =>
			deleteAllMutation.mutate(input),
		removing: deleteMutation.isPending || deleteAllMutation.isPending,
	};
}
