import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc, type RouterInputs } from "@/client";

export function useSystemSettings() {
	const queryClient = useQueryClient();
	const query = useQuery(orpc.settings.get.queryOptions());

	const mutation = useMutation({
		...orpc.settings.set.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orpc.settings.get.key() });
			toast.success("Configuração salva");
		},
		onError: (error: Error) => toast.error(`Erro ao salvar: ${error.message}`),
	});

	return {
		settings: query.data,
		loading: query.isLoading,
		save: (input: RouterInputs["settings"]["set"]) => mutation.mutate(input),
		saving: mutation.isPending,
	};
}
