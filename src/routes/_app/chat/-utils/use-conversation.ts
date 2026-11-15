import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { orpc, orpcWs } from "@/client";
import { subscribeWithRetry } from "@/lib/realtime-subscription";

export function useConversation(id: string) {
	const queryClient = useQueryClient();
	const [connected, setConnected] = useState(false);
	const { data, isPending, error } = useQuery(
		orpc.conversations.get.queryOptions({ input: { id }, throwOnError: false }),
	);

	useEffect(() => {
		const controller = new AbortController();
		void subscribeWithRetry({
			label: "Conversa",
			signal: controller.signal,
			onConnectionChange: setConnected,
			subscribe: (signal) => orpcWs.conversation.call({ id }, { signal }),
			onEvent: (detail) => {
				queryClient.setQueryData(
					orpc.conversations.get.queryOptions({ input: { id } }).queryKey,
					(current: typeof detail | undefined) => {
						if (current && current.revision > detail.revision) {
							return current;
						}
						return detail;
					},
				);
			},
		});
		return () => controller.abort();
	}, [id, queryClient]);

	return { data, isPending, error, connected };
}

export function useConversationActions(id: string) {
	const queryClient = useQueryClient();
	async function invalidate() {
		await queryClient.invalidateQueries(orpc.conversations.get.queryOptions({ input: { id } }));
		await queryClient.invalidateQueries(orpc.conversations.list.queryOptions());
	}
	const {
		mutateAsync: send,
		isPending: sending,
		error: sendError,
	} = useMutation(orpc.conversations.send.mutationOptions({ onSuccess: invalidate }));
	const {
		mutateAsync: interrupt,
		isPending: interrupting,
		error: interruptError,
	} = useMutation(orpc.conversations.interrupt.mutationOptions({ onSuccess: invalidate }));
	const {
		mutateAsync: reconcile,
		isPending: reconciling,
		error: reconcileError,
	} = useMutation(orpc.conversations.reconcile.mutationOptions({ onSuccess: invalidate }));
	return {
		send,
		sending,
		sendError,
		interrupt,
		interrupting,
		interruptError,
		reconcile,
		reconciling,
		reconcileError,
	};
}
