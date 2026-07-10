import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { orpcWs } from "@/client";

// Realtime da agenda: escuta AMBOS os canais e invalida AMBAS as roots, nas duas direções.
// - canal events → event criado/editado/deletado muda os chips (events) e o backlog (tasks).
// - canal tasks → renomear/concluir/deletar uma task muda o displayTitle/cor do chip ligado
//   (events) e o backlog (tasks). Invalidar só um canal deixaria o chip ou o backlog desatualizado.
export function useAgendaRealtime() {
	const queryClient = useQueryClient();

	useEffect(() => {
		const controller = new AbortController();

		function invalidate(projectId?: string) {
			queryClient.invalidateQueries({
				predicate: (query) => {
					const root = Array.isArray(query.queryKey[0]) ? query.queryKey[0][0] : null;
					if (root === "events") return true;
					if (root !== "tasks") return false;
					const input = (query.queryKey[1] as { input?: { projectId?: string | null } } | undefined)
						?.input;
					const queryProjectId = input?.projectId || null;
					return queryProjectId === null || projectId === undefined || queryProjectId === projectId;
				},
			});
		}

		async function subscribe(streamPromise: Promise<AsyncIterable<unknown>>) {
			try {
				const stream = await streamPromise;
				for await (const event of stream) {
					invalidate((event as { projectId?: string }).projectId);
				}
			} catch (error) {
				if (error instanceof Error && error.name === "AbortError") return;
				console.error("[Agenda Realtime] Erro na subscription:", error);
			}
		}

		subscribe(orpcWs.events.call(undefined, { signal: controller.signal }));
		subscribe(orpcWs.tasks.call(undefined, { signal: controller.signal }));

		return () => controller.abort();
	}, [queryClient]);
}
