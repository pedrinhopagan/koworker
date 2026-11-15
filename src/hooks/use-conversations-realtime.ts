import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { orpc, orpcWs } from "@/client";
import { subscribeWithRetry } from "@/lib/realtime-subscription";

export function useConversationsRealtime() {
	const queryClient = useQueryClient();

	useEffect(() => {
		const controller = new AbortController();

		void subscribeWithRetry({
			label: "Chats",
			signal: controller.signal,
			subscribe: (signal) => orpcWs.conversations.call(undefined, { signal }),
			onEvent: () => {
				void queryClient.invalidateQueries(orpc.conversations.list.queryOptions());
			},
		});

		return () => controller.abort();
	}, [queryClient]);
}
