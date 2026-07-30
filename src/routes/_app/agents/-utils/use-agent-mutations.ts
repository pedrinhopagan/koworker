import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc, type RouterInputs } from "@/client";
import type { DocSaveStatus } from "@/components/ui/save-status";
import { errorMessage } from "@/lib/orpc-errors";

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
		onError: (error) => toast.error(errorMessage(error, "Não foi possível salvar o agent")),
	});

	const standardizeMutation = useMutation({
		...orpc.agents.standardize.mutationOptions(),
		onSuccess: (result) => {
			invalidateAll();
			toast.success(
				`Padronizado em ${result.written} ${result.written === 1 ? "cópia" : "cópias"}`,
			);
		},
		onError: (error) => toast.error(errorMessage(error, "Não foi possível padronizar o agent")),
	});

	const deleteMutation = useMutation({
		...orpc.agents.delete.mutationOptions(),
		onSuccess: () => {
			invalidateAll();
			toast.success("Cópia removida");
		},
		onError: (error) => toast.error(errorMessage(error, "Não foi possível remover a cópia")),
	});

	const deleteAllMutation = useMutation({
		...orpc.agents.deleteAll.mutationOptions(),
		onSuccess: (result) => {
			invalidateAll();
			toast.success(
				`Agent removido de ${result.removed} ${result.removed === 1 ? "fonte" : "fontes"}. Backup em ${result.backupPath}`,
			);
		},
		onError: (error) => toast.error(errorMessage(error, "Não foi possível remover o agent")),
	});

	const injectMutation = useMutation({
		...orpc.agents.inject.mutationOptions(),
		onSuccess: () => {
			invalidateAll();
			toast.success("Agent injetado no projeto");
		},
		onError: (error) => toast.error(errorMessage(error, "Não foi possível injetar o agent")),
	});

	return {
		updateContent: (input: RouterInputs["agents"]["update"]) => updateMutation.mutateAsync(input),
		saveStatus: updateStatus(updateMutation.status),
		standardize: (input: RouterInputs["agents"]["standardize"]) =>
			standardizeMutation.mutate(input),
		standardizing: standardizeMutation.isPending,
		removeAgent: (path: string, onSuccess?: () => void) =>
			deleteMutation.mutate({ path }, { onSuccess }),
		removeAllAgent: (input: RouterInputs["agents"]["deleteAll"], onSuccess?: () => void) =>
			deleteAllMutation.mutate(input, { onSuccess }),
		removing: deleteMutation.isPending || deleteAllMutation.isPending,
		inject: (input: RouterInputs["agents"]["inject"]) => injectMutation.mutate(input),
		injecting: injectMutation.isPending,
	};
}

function updateStatus(status: "idle" | "pending" | "success" | "error"): DocSaveStatus {
	if (status === "pending") {
		return "saving";
	}
	if (status === "success") {
		return "saved";
	}
	if (status === "error") {
		return "error";
	}

	return "idle";
}
