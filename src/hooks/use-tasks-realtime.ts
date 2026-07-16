import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { orpc, orpcWs } from "@/client";
import { invalidateTaskQueries } from "@/lib/task-query-invalidation";

export function useTasksRealtime() {
	const queryClient = useQueryClient();

	useEffect(() => {
		const controller = new AbortController();

		async function subscribe() {
			try {
				const events = await orpcWs.tasks.call(undefined, { signal: controller.signal });

				for await (const event of events) {
					invalidateTaskQueries(queryClient, event);
					if (event.source !== "fs") {
						queryClient.invalidateQueries({
							queryKey: orpc.projects.overview.queryOptions().queryKey,
						});
					}
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
