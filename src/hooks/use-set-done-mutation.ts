import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/client";
import { docSessionKey, useDocSessionsStore } from "@/stores/doc-sessions";

// Conclui/reabre uma tarefa. Concluir também fecha as sessões de leitura da tarefa (uma por arquivo)
// no switcher Alt+` — a tab não deve sobreviver à conclusão. Compartilhado pela lista e pela página.
export function useSetDoneMutation() {
	const queryClient = useQueryClient();
	const removeRecentsByPrefix = useDocSessionsStore((s) => s.removeRecentsByPrefix);

	return useMutation({
		...orpc.tasks.setDone.mutationOptions(),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
			if (variables.done) {
				removeRecentsByPrefix(docSessionKey({ kind: "task", taskId: variables.id, file: "" }));
			}
		},
	});
}
