import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { orpcWs } from "@/client";

// Consome o canal `tasks` via WS (eventos da API, CLI ou watcher de FS) e invalida
// todas as queries de tasks pra refazer o fetch. Montado uma vez no layout `_app`.
export function useTasksRealtime() {
	const queryClient = useQueryClient();

	useEffect(() => {
		const controller = new AbortController();

		async function subscribe() {
			try {
				const events = await orpcWs.tasks.call(undefined, { signal: controller.signal });

				for await (const _event of events) {
					queryClient.invalidateQueries({
						predicate: (query) => {
							const root = Array.isArray(query.queryKey[0]) ? query.queryKey[0][0] : null;
							return root === "tasks" || root === "vault";
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
