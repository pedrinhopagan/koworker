import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/client";

// Mutations da página de skill: gravar o arquivo (autosave do corpo + descrição), padronizar as
// variantes divergentes e remover. `updateContent` é silencioso no sucesso (dispara via debounce do
// editor); revalida `list` e `get` — `get` é single-slug e o editor é keyado por path, então o
// refetch na mesma tab não remonta nem atropela o que está sendo digitado. Padronizar e delete
// avisam porque são ações únicas e destrutivas.
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
			toast.success(
				`Padronizado em ${result.written} ${result.written === 1 ? "cópia" : "cópias"}`,
			);
		},
		onError: (error: Error) => toast.error(`Erro ao padronizar: ${error.message}`),
	});

	const replicateMutation = useMutation({
		...orpc.skills.replicate.mutationOptions(),
		onSuccess: (result) => {
			invalidateAll();
			if (result.written === 0) {
				toast.success("Já sincronizada em todos os ambientes");
				return;
			}
			const envLabel = result.written === 1 ? "ambiente" : "ambientes";
			const syncedLabel =
				result.unchanged > 0
					? ` (${result.unchanged} já ${result.unchanged === 1 ? "sincronizado" : "sincronizados"})`
					: "";
			toast.success(`Replicada em ${result.written} ${envLabel}${syncedLabel}`);
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
			path: string;
			description: string;
			content: string;
			metadata: Record<string, unknown>;
		}) => updateMutation.mutateAsync(input),
		standardize: (input: { slug: string; projectName?: string; sourcePath: string }) =>
			standardizeMutation.mutate(input),
		standardizing: standardizeMutation.isPending,
		replicate: (input: { slug: string; projectName?: string }) => replicateMutation.mutate(input),
		replicating: replicateMutation.isPending,
		removeSkill: (path: string) => deleteMutation.mutate({ path }),
		removeAllSkill: (input: { slug: string; projectName?: string }) =>
			deleteAllMutation.mutate(input),
		removing: deleteMutation.isPending || deleteAllMutation.isPending,
	};
}
