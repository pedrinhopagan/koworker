import type { AgentSessionEvent } from "@/lib/agent-session";
import type { CodexItem, CodexTurn } from "@/lib/conversation";
import { conversationUserText } from "@/lib/conversation-presentation";

export function conversationPromptReceipts(turns: CodexTurn[]): AgentSessionEvent[] {
	return turns
		.flatMap((turn) => turn.items)
		.flatMap((item, seq) => {
			if (item.type !== "userMessage") {
				return [];
			}
			return [
				{
					id: item.id,
					sessionId: "",
					seq,
					at: 0,
					payload: { kind: "user" as const, text: conversationUserText(item) },
				},
			];
		});
}

function transcriptItem(event: AgentSessionEvent): CodexItem | null {
	const { payload } = event;
	const id = event.id;
	if (payload.kind === "user") {
		return {
			id,
			type: "userMessage",
			content: [
				{ type: "text", text: payload.text },
				...Array.from({ length: payload.images ?? 0 }, () => ({ type: "image" })),
			],
		};
	}
	if (payload.kind === "assistant") {
		return { id, type: "agentMessage", text: payload.text, phase: "commentary" };
	}
	if (payload.kind === "thinking") {
		return { id, type: "reasoning", summary: [payload.text] };
	}
	if (payload.kind === "tool_use") {
		return {
			id,
			type: "dynamicToolCall",
			tool: payload.name,
			arguments: payload.detail,
			status: { running: "inProgress", ok: "completed", error: "failed" }[payload.status],
		};
	}
	if (payload.kind === "question") {
		return {
			id,
			type: "agentMessage",
			text: payload.answers ? `${payload.question}\n\nResposta: ${payload.answers.join(", ")}` : "",
			...(payload.answers
				? {}
				: {
						questions: [
							{ title: payload.question, options: payload.options.map((option) => option.label) },
						],
					}),
			phase: "commentary",
		};
	}
	if (payload.kind === "notice" || payload.kind === "permission") {
		return {
			id,
			type: "notice",
			text: [payload.label, payload.detail].filter(Boolean).join("\n\n"),
		};
	}
	return null;
}

export function transcriptConversationTurns(
	events: AgentSessionEvent[],
	busy: boolean,
): CodexTurn[] {
	const turns: CodexTurn[] = [];
	for (const event of events) {
		const previous = turns.at(-1);
		const turn =
			previous?.status === "inProgress"
				? previous
				: {
						id: event.id,
						status: "inProgress" as const,
						items: [] as CodexItem[],
					};
		if (turn !== previous) {
			turns.push(turn);
		}
		if (event.payload.kind === "result") {
			const { payload } = event;
			const status: Record<typeof payload.status, CodexTurn["status"]> = {
				done: "completed",
				failed: "failed",
				timeout: "failed",
				cancelled: "interrupted",
			};
			turn.status = status[payload.status];
			turn.durationMs = payload.durationMs;
			if (payload.error) {
				turn.error = { message: payload.error };
			}
			const answer = turn.items.findLast(
				(item) => item.type === "agentMessage" && !item.questions?.length,
			);
			if (answer && turn.status === "completed") {
				answer.phase = "final_answer";
			}
			continue;
		}
		const item = transcriptItem(event);
		if (item) {
			turn.items.push(item);
		}
	}
	const last = turns.at(-1);
	if (last?.status === "inProgress" && !busy) {
		last.status = "completed";
	}
	return turns;
}
