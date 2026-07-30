import { z } from "zod";

import type { AgentSessionPatch } from "@/lib/agent-session";
import { claudeResultText, describeClaudeTool, trim } from "@/lib/agent-stream";

const ContentBlockSchema = z.object({
	type: z.string(),
	text: z.string().optional(),
	thinking: z.string().optional(),
	id: z.string().optional(),
	name: z.string().optional(),
	input: z.record(z.string(), z.unknown()).optional(),
	tool_use_id: z.string().optional(),
	is_error: z.boolean().optional(),
	content: z.unknown().optional(),
});

// Uma linha do stdout do CLI. O envelope é frouxo de propósito: a versão do CLI ganha campos novos a
// cada release e o que não é reconhecido aqui simplesmente não vira bloco na conversa.
const StreamLineSchema = z.object({
	type: z.string().optional(),
	subtype: z.string().optional(),
	session_id: z.string().optional(),
	model: z.string().optional(),
	result: z.string().optional(),
	is_error: z.boolean().optional(),
	duration_ms: z.number().optional(),
	total_cost_usd: z.number().optional(),
	message: z.object({ content: z.array(ContentBlockSchema).optional() }).optional(),
	request_id: z.string().optional(),
	request: z
		.object({
			subtype: z.string().optional(),
			tool_name: z.string().optional(),
			input: z.record(z.string(), z.unknown()).optional(),
			permission_suggestions: z.unknown().optional(),
		})
		.optional(),
});

const RESULT_SUBTYPES = new Set(["success", "error_max_turns", "error_during_execution"]);

function assistantPatches(content: z.infer<typeof ContentBlockSchema>[]): AgentSessionPatch[] {
	return content.flatMap((block): AgentSessionPatch[] => {
		if (block.type === "thinking" && block.thinking?.trim()) {
			return [{ type: "append", payload: { kind: "thinking", text: block.thinking } }];
		}

		if (block.type === "text" && block.text?.trim()) {
			return [{ type: "append", payload: { kind: "assistant", text: block.text } }];
		}

		if (block.type === "tool_use" && block.name) {
			const described = describeClaudeTool(block.name, block.input);
			const detail = trim(described.detail, 400);

			return [
				{
					type: "append",
					payload: {
						kind: "tool_use",
						name: block.name,
						label: described.label,
						status: "running",
						...(block.id ? { toolUseId: block.id } : {}),
						...(detail ? { detail } : {}),
					},
				},
			];
		}

		return [];
	});
}

// Traduz o stdout do CLI para os blocos da conversa. Fica em `lib` porque o mesmo shape é o que a
// rota renderiza: o backend grava o que sai daqui e o front lê sem reinterpretar nada.
export function translateClaudeLine(raw: unknown): AgentSessionPatch[] {
	const parsed = StreamLineSchema.safeParse(raw);
	if (!parsed.success) {
		return [];
	}

	const line = parsed.data;

	if (line.type === "control_request" && line.request?.subtype === "can_use_tool") {
		const toolName = line.request.tool_name ?? "Ferramenta";
		const described = describeClaudeTool(toolName, line.request.input);
		const detail = trim(described.detail, 400);

		return [
			{
				type: "permission",
				requestId: line.request_id ?? crypto.randomUUID(),
				toolName,
				label: described.label,
				input: line.request.input ?? {},
				...(detail ? { detail } : {}),
			},
		];
	}

	// O CLI reanuncia `system/init` a cada turno: virar bloco poluiria a conversa com um "sessão
	// iniciada" por mensagem. Modelo e estado da sessão já vivem no cabeçalho da rota.
	if (line.type === "system") {
		return [];
	}

	if (line.type === "assistant") {
		return assistantPatches(line.message?.content ?? []);
	}

	if (line.type === "user") {
		return (line.message?.content ?? []).flatMap((block): AgentSessionPatch[] => {
			if (block.type !== "tool_result" || !block.tool_use_id) {
				return [];
			}
			const detail = block.is_error ? trim(claudeResultText(block.content), 400) : undefined;

			return [
				{
					type: "settle",
					toolUseId: block.tool_use_id,
					ok: !block.is_error,
					...(detail ? { detail } : {}),
				},
			];
		});
	}

	if (line.type === "result" || (line.subtype && RESULT_SUBTYPES.has(line.subtype))) {
		return [
			{
				type: "result",
				status: line.is_error ? "failed" : "done",
				...(line.duration_ms ? { durationMs: line.duration_ms } : {}),
				...(line.total_cost_usd ? { costUsd: line.total_cost_usd } : {}),
			},
		];
	}

	return [];
}

// O CLI entrega JSONL em pedaços arbitrários: a linha parcial de um chunk espera o próximo.
export function createClaudeSessionParser() {
	let pending = "";

	function line(value: string): AgentSessionPatch[] {
		if (!value.trim()) {
			return [];
		}

		try {
			return translateClaudeLine(JSON.parse(value));
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
