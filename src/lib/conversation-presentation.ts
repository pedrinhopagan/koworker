import type { CodexItem, CodexTurn } from "@/lib/conversation";
import { CONVERSATION_ITEM_LABELS } from "@/constants/conversation";

export function conversationItemVisible(item: CodexItem) {
	if (item.type === "reasoning") {
		return (
			!!item.summary?.some((text) => !!text.trim()) ||
			!!item.content?.some((part) => typeof part === "string" && !!part.trim())
		);
	}
	if (item.type === "agentMessage") {
		return !!item.text?.trim() || !!item.questions?.length;
	}
	return item.type !== "hookPrompt";
}

export function conversationSegments(turn: CodexTurn) {
	const segments: { id: string; kind: "message" | "activity"; items: CodexItem[] }[] = [];
	for (const item of turn.items.filter(conversationItemVisible)) {
		const kind =
			item.type === "userMessage" || item.type === "agentMessage" ? "message" : "activity";
		const previous = segments.at(-1);
		if (kind === "activity" && previous?.kind === kind) {
			previous.items.push(item);
		} else {
			segments.push({ id: item.id, kind, items: [item] });
		}
	}
	return segments;
}

export function conversationToolTitle(item: CodexItem) {
	if (item.type === "commandExecution") {
		const action = item.commandActions?.[0];
		if (action?.type === "read") {
			return `Ler ${action.name ?? action.path ?? "arquivo"}`;
		}
		if (action?.type === "listFiles") {
			return "Listar arquivos";
		}
		if (action?.type === "search") {
			return "Buscar nos arquivos";
		}
		return "Executar comando";
	}
	if (item.type === "fileChange") {
		const count = item.changes?.length ?? 0;
		return count === 1 ? "Alterar arquivo" : `Alterar ${count} arquivos`;
	}
	if (item.type === "mcpToolCall" || item.type === "dynamicToolCall") {
		return [item.server ?? item.namespace, item.tool].filter(Boolean).join(" · ") || "Ferramenta";
	}
	if (item.type === "functionCallOutput") {
		return item.name ?? "Resultado de ferramenta";
	}
	return CONVERSATION_ITEM_LABELS[item.type] ?? "Atividade do agente";
}

export function conversationToolFailed(item: CodexItem) {
	return (
		item.status === "failed" ||
		item.status === "declined" ||
		item.success === false ||
		!!item.error ||
		(typeof item.exitCode === "number" && item.exitCode !== 0)
	);
}

export function conversationUserText(item: CodexItem) {
	return (item.content ?? [])
		.flatMap((part) => {
			if (typeof part === "string") {
				return [part];
			}
			return part.type === "text" && part.text ? [part.text] : [];
		})
		.join("\n\n");
}

export function conversationValueText(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}
	if (value === undefined || value === null) {
		return "";
	}
	return JSON.stringify(value, null, 2);
}
