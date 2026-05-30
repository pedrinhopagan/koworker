import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/client";

export function useSkillSettingsMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		...orpc.skills.updateSettings.mutationOptions(),
		onSuccess: () => {
			toast.success("Aparência da skill atualizada");
			queryClient.invalidateQueries({ queryKey: orpc.skills.list.key() });
			queryClient.invalidateQueries({ queryKey: orpc.skills.get.key() });
		},
		onError: (error: Error) => {
			toast.error(`Erro ao salvar: ${error.message}`);
		},
	});
}
