import type { AgentSessionPatch } from "@/lib/agent-session";
import { CodexEventSchema, describeCodexItem, trim } from "@/lib/agent-stream";

const DETAIL_MAX_CHARS = 400;

// O `codex exec` não tem canal de controle: cada turno é um processo próprio que anuncia o
// `thread_id` na primeira linha e fecha no `turn.completed`. O `started` é a memória do turno —
// o mesmo item aparece em `item.started` e em `item.completed`, e sem ela o passo duplicaria.
export function translateCodexLine(raw: unknown, started: Set<string>): AgentSessionPatch[] {
	const parsed = CodexEventSchema.safeParse(raw);
	if (!parsed.success) {
		return [];
	}

	const event = parsed.data;

	if (event.type === "thread.started" && event.thread_id) {
		return [{ type: "cliSession", cliSessionId: event.thread_id }];
	}

	if (event.type === "turn.completed") {
		return [{ type: "result", status: "done" }];
	}

	if (event.type === "turn.failed" || event.type === "error") {
		const error = trim(event.error?.message, DETAIL_MAX_CHARS);

		return [{ type: "result", status: "failed", ...(error ? { error } : {}) }];
	}

	const item = event.item;
	if (!item) {
		return [];
	}

	const described = describeCodexItem(item);

	if (event.type === "item.started") {
		if (described.kind !== "tool" || !item.id) {
			return [];
		}
		started.add(item.id);
		const detail = trim(described.detail, DETAIL_MAX_CHARS);

		return [
			{
				type: "append",
				payload: {
					kind: "tool_use",
					toolUseId: item.id,
					name: item.type,
					label: described.label,
					status: "running",
					...(detail ? { detail } : {}),
				},
			},
		];
	}

	if (event.type !== "item.completed") {
		return [];
	}

	// A fala e o raciocínio são a conversa em si: entram inteiros, sem o corte que os passos levam.
	if (item.type === "agent_message") {
		return item.text?.trim()
			? [{ type: "append", payload: { kind: "assistant", text: item.text } }]
			: [];
	}

	if (item.type === "reasoning") {
		return item.text?.trim()
			? [{ type: "append", payload: { kind: "thinking", text: item.text } }]
			: [];
	}

	const failed = item.status === "failed" || (item.exit_code ?? 0) !== 0;
	const detail = trim(described.detail, DETAIL_MAX_CHARS);

	if (described.kind === "notice") {
		return [
			{
				type: "append",
				payload: {
					kind: "notice",
					label: described.label,
					tone: failed ? "error" : "info",
					...(detail ? { detail } : {}),
				},
			},
		];
	}

	if (item.id && started.delete(item.id)) {
		return [{ type: "settle", toolUseId: item.id, ok: !failed, ...(detail ? { detail } : {}) }];
	}

	return [
		{
			type: "append",
			payload: {
				kind: "tool_use",
				name: item.type,
				label: described.label,
				status: failed ? "error" : "ok",
				...(item.id ? { toolUseId: item.id } : {}),
				...(detail ? { detail } : {}),
			},
		},
	];
}

export function createCodexSessionParser() {
	const started = new Set<string>();
	let pending = "";

	function line(value: string): AgentSessionPatch[] {
		if (!value.trim()) {
			return [];
		}

		try {
			return translateCodexLine(JSON.parse(value), started);
		} catch {
			return [];
		}
	}

	return {
		push(chunk: string): AgentSessionPatch[] {
			const lines = `${pending}${chunk}`.split("\n");
			pending = lines.pop() ?? "";

			return lines.flatMap(line);
		},
		flush(): AgentSessionPatch[] {
			const rest = pending;
			pending = "";

			return line(rest);
		},
	};
}
