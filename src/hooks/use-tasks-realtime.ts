import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { orpcWs } from "@/client";

// Consome o canal `tasks` via WS (eventos da API, CLI ou watcher de FS) e invalida as queries de
// tasks/vault do projeto afetado — as agregadas ("Todos", sem projectId) sempre entram. Um evento de
// outro projeto não refaz o fetch da visão ativa. Montado uma vez no layout `_app`.
export function useTasksRealtime() {
	const queryClient = useQueryClient();

	useEffect(() => {
		const controller = new AbortController();

		async function subscribe() {
			try {
				const events = await orpcWs.tasks.call(undefined, { signal: controller.signal });

				for await (const event of events) {
					queryClient.invalidateQueries({
						predicate: (query) => {
							const root = Array.isArray(query.queryKey[0]) ? query.queryKey[0][0] : null;
							if (root !== "tasks" && root !== "vault") return false;
							const input = (
								query.queryKey[1] as { input?: { projectId?: string | null } } | undefined
							)?.input;
							const queryProjectId = input?.projectId || null;
							return queryProjectId === null || queryProjectId === event.projectId;
						},
					});
				}
			} catch (error) {
				if (error instanceof Error && error.name === "AbortError") return;
				console.error("[Tasks Realtime] Erro na subscription:", error);
			}
		}

		subscribe();

		return () => controller.abort();
	}, [queryClient]);
}
