import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/client";

export function useConversationList() {
	const { data, isPending, error, refetch } = useQuery(
		orpc.conversations.list.queryOptions({ throwOnError: false }),
	);
	return { conversations: data ?? [], isPending, error, refetch };
}
