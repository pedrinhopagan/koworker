import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/client";

export function useAgentSettingsMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		...orpc.agents.updateSettings.mutationOptions(),
		onSuccess: () => {
			toast.success("Aparência do agent atualizada");
			queryClient.invalidateQueries({ queryKey: orpc.agents.list.key() });
			queryClient.invalidateQueries({ queryKey: orpc.agents.get.key() });
		},
		onError: (error: Error) => {
			toast.error(`Erro ao salvar: ${error.message}`);
		},
	});
}
