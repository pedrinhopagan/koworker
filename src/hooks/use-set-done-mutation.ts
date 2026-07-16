import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/client";
import { invalidateTaskQueries } from "@/lib/task-query-invalidation";
import { docSessionKey, useDocSessionsStore } from "@/stores/doc-sessions";

// Conclui/reabre uma tarefa. Concluir também fecha as sessões de leitura da tarefa (uma por arquivo)
// no switcher Alt+` — a tab não deve sobreviver à conclusão. Compartilhado pela lista e pela página.
export function useSetDoneMutation(projectId?: string | null) {
	const queryClient = useQueryClient();
	const removeRecentsByPrefix = useDocSessionsStore((s) => s.removeRecentsByPrefix);

	return useMutation({
		...orpc.tasks.setDone.mutationOptions(),
		onSuccess: (_data, variables) => {
			invalidateTaskQueries(queryClient, { taskId: variables.id, projectId });
			if (variables.done) {
				removeRecentsByPrefix(docSessionKey({ kind: "task", taskId: variables.id, file: "" }));
			}
		},
	});
}
