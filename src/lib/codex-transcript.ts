import { z } from "zod";

import { trim } from "@/lib/agent-stream";
import type { TranscriptPatch } from "@/lib/agent-transcript";

const DETAIL_MAX_CHARS = 400;

// O rollout que o `codex` grava em `~/.codex/sessions` mistura três coisas na mesma linha: o evento
// da interface (`event_msg`), o item cru do modelo (`response_item`) e a configuração do turno. A
// conversa está no primeiro; a ferramenta e o resultado dela, no segundo.
const RolloutLineSchema = z.object({
	type: z.string(),
	payload: z.object({
		type: z.string().optional(),
		message: z.string().optional(),
		text: z.string().optional(),
		name: z.string().optional(),
		call_id: z.string().optional(),
		arguments: z.string().optional(),
		input: z.string().optional(),
		output: z.unknown().optional(),
	}),
});

const TOOL_LABELS: Record<string, string> = {
	exec: "Terminal",
	exec_command: "Terminal",
	shell: "Terminal",
	apply_patch: "Alterar arquivos",
	view_image: "Ver imagem",
	imagegen: "Gerar imagem",
	web_search: "Pesquisar na web",
	update_plan: "Atualizar plano",
	spawn_agent: "Subagente",
	followup_task: "Subagente",
	send_message: "Subagente",
	wait_agent: "Esperar subagente",
	list_agents: "Listar subagentes",
	interrupt_agent: "Interromper subagente",
	wait: "Esperar comando",
};

const EXIT_CODE = /(?:Process exited with code|Exit code:)\s*(\d+)/;
const PATCH_FILE = /\*\*\* (?:Update|Add|Delete) File: (.+)/g;
const COMMAND_ARGUMENT = /"cmd"\s*:\s*("(?:[^"\\]|\\.)*")/;
// A ordem é a de quem descreve melhor o passo. `message` vem por último porque a conversa entre
// agentes trafega cifrada nesse campo: mostrar o alvo diz mais que mostrar o blob.
const DETAIL_KEYS = ["cmd", "command", "path", "query", "task_name", "target", "prompt", "message"];

function jsonRecord(raw: string | undefined) {
	if (!raw?.trim().startsWith("{")) {
		return null;
	}

	try {
		const parsed: unknown = JSON.parse(raw);

		return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

// O alvo da ferramenta é o que identifica o passo, e o codex o esconde em três lugares diferentes:
// no JSON de argumentos, no patch literal e no JavaScript que a chamada de ferramenta livre carrega.
function toolDetail(name: string, raw: string | undefined) {
	if (!raw) {
		return;
	}

	if (name === "apply_patch") {
		return [...raw.matchAll(PATCH_FILE)].map((match) => match[1]?.trim()).join(", ");
	}

	const record = jsonRecord(raw);
	if (!record) {
		const command = COMMAND_ARGUMENT.exec(raw)?.[1];

		return command ? String(JSON.parse(command)) : raw;
	}

	const value = DETAIL_KEYS.map((key) => record[key]).find(
		(entry) => typeof entry === "string" && entry.trim(),
	);

	return typeof value === "string" ? value : undefined;
}

function toolPatch(payload: z.infer<typeof RolloutLineSchema>["payload"]): TranscriptPatch[] {
	if (!payload.call_id || !payload.name) {
		return [];
	}

	const detail = trim(
		toolDetail(payload.name, payload.arguments ?? payload.input),
		DETAIL_MAX_CHARS,
	);

	return [
		{
			type: "append",
			payload: {
				kind: "tool_use",
				toolUseId: payload.call_id,
				name: payload.name,
				label: TOOL_LABELS[payload.name] ?? payload.name,
				status: "running",
				...(detail ? { detail } : {}),
			},
		},
	];
}

// A saída de imagem chega como lista de blocos, não como texto: nesse caso não há código de saída
// para ler e o passo só pode ter dado certo.
function outputPatch(payload: z.infer<typeof RolloutLineSchema>["payload"]): TranscriptPatch[] {
	if (!payload.call_id) {
		return [];
	}

	const output = typeof payload.output === "string" ? payload.output : "";
	const code = EXIT_CODE.exec(output)?.[1];
	const failed = !!code && code !== "0";
	const detail = failed ? trim(output, DETAIL_MAX_CHARS) : undefined;

	return [
		{ type: "settle", toolUseId: payload.call_id, ok: !failed, ...(detail ? { detail } : {}) },
	];
}

export function translateCodexTranscriptLine(raw: unknown): TranscriptPatch[] {
	const parsed = RolloutLineSchema.safeParse(raw);
	if (!parsed.success) {
		return [];
	}

	const { type, payload } = parsed.data;

	if (type === "event_msg") {
		if (payload.type === "user_message" && payload.message?.trim()) {
			return [{ type: "append", payload: { kind: "user", text: payload.message } }];
		}

		if (payload.type === "agent_message" && payload.message?.trim()) {
			return [{ type: "append", payload: { kind: "assistant", text: payload.message } }];
		}

		// O raciocínio só aparece quando o modelo o entrega em texto: o `response_item` guarda a versão
		// cifrada, que não é legível para ninguém.
		if (payload.type === "agent_reasoning" && payload.text?.trim()) {
			return [{ type: "append", payload: { kind: "thinking", text: payload.text } }];
		}

		if (payload.type === "task_complete") {
			return [{ type: "result", status: "done" }];
		}

		if (payload.type === "error") {
			const error = trim(payload.message, DETAIL_MAX_CHARS);

			return [{ type: "result", status: "failed", ...(error ? { error } : {}) }];
		}

		return [];
	}

	if (type !== "response_item") {
		return [];
	}

	if (payload.type === "function_call" || payload.type === "custom_tool_call") {
		return toolPatch(payload);
	}

	if (payload.type === "function_call_output" || payload.type === "custom_tool_call_output") {
		return outputPatch(payload);
	}

	return [];
}
