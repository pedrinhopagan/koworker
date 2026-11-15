import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/client";
import { useAgentRadar } from "@/hooks/use-agent-radar";

export function useChatAttention() {
	const { agents } = useAgentRadar();
	const { data: conversations = [] } = useQuery(
		orpc.conversations.list.queryOptions({ throwOnError: false }),
	);
	const liveThreads = new Set(
		agents.filter((agent) => agent.agent === "codex").map((agent) => agent.sessionId),
	);
	const native = conversations.filter(
		(conversation) => !conversation.threadId || !liveThreads.has(conversation.threadId),
	);
	const working =
		agents.filter((agent) => agent.status === "working").length +
		native.filter((conversation) => conversation.busy && !conversation.waiting).length;
	const waiting =
		agents.filter((agent) => agent.status === "blocked").length +
		native.filter((conversation) => conversation.waiting).length;
	const label = [
		waiting > 0 && `${waiting} esperando você`,
		working > 0 && `${working} trabalhando`,
	]
		.filter(Boolean)
		.join(", ");

	return { working, waiting, label };
}
