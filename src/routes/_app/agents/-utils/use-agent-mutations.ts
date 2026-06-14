import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/client";

// Mutations da página de agent: gravar o arquivo (autosave do corpo + descrição), padronizar as
// variantes divergentes e remover. `updateContent` é silencioso no sucesso (dispara via debounce do
// editor); revalida `list` e `get` — `get` é single-slug e o editor é keyado por path, então o
// refetch na mesma tab não remonta nem atropela o que está sendo digitado. Padronizar e delete
// avisam porque são ações únicas e destrutivas.
export function useAgentMutations() {
	const queryClient = useQueryClient();
	const invalidateList = () => queryClient.invalidateQueries({ queryKey: orpc.agents.list.key() });
	const invalidateAll = () => {
		invalidateList();
		queryClient.invalidateQueries({ queryKey: orpc.agents.get.key() });
	};

	const updateMutation = useMutation({
		...orpc.agents.update.mutationOptions(),
		onSuccess: invalidateAll,
		onError: (error: Error) => toast.error(`Erro ao salvar agent: ${error.message}`),
	});

	const standardizeMutation = useMutation({
		...orpc.agents.standardize.mutationOptions(),
		onSuccess: (result) => {
			invalidateAll();
			toast.success(
				`Padronizado em ${result.written} ${result.written === 1 ? "cópia" : "cópias"}`,
			);
		},
		onError: (error: Error) => toast.error(`Erro ao padronizar: ${error.message}`),
	});

	const deleteMutation = useMutation({
		...orpc.agents.delete.mutationOptions(),
		onSuccess: () => {
			invalidateAll();
			toast.success("Cópia removida");
		},
		onError: (error: Error) => toast.error(`Erro ao remover agent: ${error.message}`),
	});

	const deleteAllMutation = useMutation({
		...orpc.agents.deleteAll.mutationOptions(),
		onSuccess: (result) => {
			invalidateAll();
			toast.success(
				`Agent removido de ${result.removed} ${result.removed === 1 ? "fonte" : "fontes"}`,
			);
		},
		onError: (error: Error) => toast.error(`Erro ao remover agent: ${error.message}`),
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
		removeAgent: (path: string) => deleteMutation.mutate({ path }),
		removeAllAgent: (input: { slug: string; projectName?: string }) =>
			deleteAllMutation.mutate(input),
		removing: deleteMutation.isPending || deleteAllMutation.isPending,
	};
}
