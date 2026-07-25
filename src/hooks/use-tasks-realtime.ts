import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { orpc, orpcWs } from "@/client";
import { subscribeWithRetry } from "@/lib/realtime-subscription";
import { invalidateTaskQueries } from "@/lib/task-query-invalidation";

export function useTasksRealtime() {
	const queryClient = useQueryClient();

	useEffect(() => {
		const controller = new AbortController();

		subscribeWithRetry({
			label: "Tasks Realtime",
			signal: controller.signal,
			subscribe: (signal) => orpcWs.tasks.call(undefined, { signal }),
			onEvent: (event) => {
				invalidateTaskQueries(queryClient, event);
				if (event.source !== "fs") {
					queryClient.invalidateQueries({
						queryKey: orpc.projects.overview.queryOptions().queryKey,
					});
				}
			},
			onReconnect: () => {
				invalidateTaskQueries(queryClient, { projectId: null });
				queryClient.invalidateQueries({
					queryKey: orpc.projects.overview.queryOptions().queryKey,
				});
			},
		});

		return () => controller.abort();
	}, [queryClient]);
}
