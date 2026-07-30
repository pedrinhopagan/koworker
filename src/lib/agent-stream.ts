import { z } from "zod";

import type { InvokeCli } from "@/constants/invoke";

const DETAIL_MAX_CHARS = 240;

export type AgentStepKind = "thinking" | "tool" | "message" | "notice";

export type AgentStepStatus = "running" | "ok" | "error";

export type AgentStep = {
	seq: number;
	kind: AgentStepKind;
	label: string;
	detail?: string;
	status: AgentStepStatus;
	at: number;
};

export type AgentStepPatch =
	| { type: "append"; ref?: string; step: Omit<AgentStep, "seq" | "at"> }
	| { type: "settle"; ref: string; status: AgentStepStatus; detail?: string };

export type AgentStreamResult = {
	output?: string;
	sessionId?: string;
	durationMs?: number;
	turns?: number;
	costUsd?: number;
};

const ClaudeContentSchema = z.object({
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

const ClaudeEventSchema = z.object({
	type: z.string(),
	subtype: z.string().optional(),
	session_id: z.string().optional(),
	model: z.string().optional(),
	result: z.string().optional(),
	is_error: z.boolean().optional(),
	duration_ms: z.number().optional(),
	num_turns: z.number().optional(),
	total_cost_usd: z.number().optional(),
	message: z.object({ content: z.array(ClaudeContentSchema).optional() }).optional(),
});

const CodexItemSchema = z.object({
	id: z.string().optional(),
	type: z.string(),
	text: z.string().optional(),
	command: z.string().optional(),
	exit_code: z.number().optional(),
	status: z.string().optional(),
	aggregated_output: z.string().optional(),
	tool: z.string().optional(),
	server: z.string().optional(),
	query: z.string().optional(),
	changes: z.array(z.object({ path: z.string(), kind: z.string().optional() })).optional(),
});

export const CodexEventSchema = z.object({
	type: z.string(),
	thread_id: z.string().optional(),
	item: CodexItemSchema.optional(),
	usage: z.object({ input_tokens: z.number().optional() }).optional(),
	error: z.object({ message: z.string().optional() }).optional(),
});

export function trim(value: string | undefined, max = DETAIL_MAX_CHARS) {
	const clean = value?.replaceAll(/\s+/g, " ").trim();
	if (!clean) {
		return;
	}

	return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function parseJsonLine(line: string) {
	if (!line.trim()) {
		return null;
	}

	try {
		return JSON.parse(line) as unknown;
	} catch {
		return null;
	}
}

function stringInput(input: Record<string, unknown> | undefined, key: string) {
	const value = input?.[key];
	return typeof value === "string" ? value : undefined;
}

// Caminho absoluto ocupa a largura inteira de um celular e a parte que identifica o arquivo é o fim.
function shortPath(value: string | undefined) {
	if (!value || value.length <= 44 || !value.includes("/")) {
		return value;
	}

	return `…/${value.split("/").slice(-2).join("/")}`;
}

// Nome cru da ferramenta não diz o que ela está fazendo. O que importa na tela do celular é o verbo
// mais o alvo: "Editar src/api/router.ts" em vez de "Edit".
export function describeClaudeTool(name: string, input: Record<string, unknown> | undefined) {
	const path = shortPath(stringInput(input, "file_path") ?? stringInput(input, "path"));
	const pattern = stringInput(input, "pattern");

	switch (name) {
		case "Bash":
			return { label: "Terminal", detail: stringInput(input, "command") };
		case "Read":
			return { label: "Ler arquivo", detail: path };
		case "Edit":
			return { label: "Editar arquivo", detail: path };
		case "Write":
			return { label: "Escrever arquivo", detail: path };
		case "NotebookEdit":
			return { label: "Editar notebook", detail: path };
		case "Grep":
			return { label: "Buscar no código", detail: pattern };
		case "Glob":
			return { label: "Listar arquivos", detail: pattern };
		case "WebFetch":
			return { label: "Abrir página", detail: stringInput(input, "url") };
		case "WebSearch":
			return { label: "Pesquisar na web", detail: stringInput(input, "query") };
		case "TodoWrite":
			return { label: "Atualizar plano", detail: undefined };
		case "Task":
			return { label: "Subagente", detail: stringInput(input, "description") };
		case "Skill":
			return { label: "Skill", detail: stringInput(input, "skill") };
		default: {
			// `mcp__servidor__ferramenta` ocupa a linha inteira e o que identifica a ação é o fim.
			const mcp = name.startsWith("mcp__") ? name.split("__").slice(2).join("__") : null;

			return {
				label: mcp ? `MCP: ${mcp}` : name,
				detail: path ?? stringInput(input, "command"),
			};
		}
	}
}

function describeCodexChanges(item: z.infer<typeof CodexItemSchema>) {
	return item.changes?.map((change) => shortPath(change.path)).join(", ");
}

export function claudeResultText(content: unknown) {
	if (typeof content === "string") {
		return content;
	}
	if (!Array.isArray(content)) {
		return;
	}

	return content
		.map((entry) =>
			entry && typeof entry === "object" && "text" in entry
				? String((entry as { text?: unknown }).text ?? "")
				: "",
		)
		.join(" ");
}

function claudePatches(raw: unknown, state: AgentStreamResult): AgentStepPatch[] {
	const parsed = ClaudeEventSchema.safeParse(raw);
	if (!parsed.success) {
		return [];
	}

	const event = parsed.data;
	if (event.session_id) {
		state.sessionId = event.session_id;
	}

	if (event.type === "system" && event.subtype === "init") {
		return [
			{
				type: "append",
				step: {
					kind: "notice",
					label: "Sessão iniciada",
					status: "ok",
					...(event.model ? { detail: event.model } : {}),
				},
			},
		];
	}

	if (event.type === "assistant") {
		return (event.message?.content ?? []).flatMap((block): AgentStepPatch[] => {
			if (block.type === "thinking") {
				const detail = trim(block.thinking);

				return [
					{
						type: "append",
						step: {
							kind: "thinking",
							label: "Pensando",
							status: "ok",
							...(detail ? { detail } : {}),
						},
					},
				];
			}
			if (block.type === "text") {
				const detail = trim(block.text, 600);

				return detail
					? [{ type: "append", step: { kind: "message", label: "Agente", detail, status: "ok" } }]
					: [];
			}
			if (block.type === "tool_use" && block.name) {
				const described = describeClaudeTool(block.name, block.input);
				const detail = trim(described.detail);

				return [
					{
						type: "append",
						...(block.id ? { ref: block.id } : {}),
						step: {
							kind: "tool",
							label: described.label,
							status: "running",
							...(detail ? { detail } : {}),
						},
					},
				];
			}

			return [];
		});
	}

	if (event.type === "user") {
		return (event.message?.content ?? []).flatMap((block): AgentStepPatch[] => {
			if (block.type !== "tool_result" || !block.tool_use_id) {
				return [];
			}
			const detail = block.is_error ? trim(claudeResultText(block.content)) : undefined;

			return [
				{
					type: "settle",
					ref: block.tool_use_id,
					status: block.is_error ? "error" : "ok",
					...(detail ? { detail } : {}),
				},
			];
		});
	}

	if (event.type === "result") {
		state.output = event.result ?? state.output;
		state.durationMs = event.duration_ms;
		state.turns = event.num_turns;
		state.costUsd = event.total_cost_usd;

		// O desfecho bem-sucedido já aparece como a resposta do turno: só a falha precisa virar passo.
		return event.is_error
			? [
					{
						type: "append",
						step: { kind: "notice", label: "Sessão encerrada com erro", status: "error" },
					},
				]
			: [];
	}

	return [];
}

export function describeCodexItem(item: z.infer<typeof CodexItemSchema>) {
	switch (item.type) {
		case "reasoning":
			return { kind: "thinking" as const, label: "Pensando", detail: item.text };
		case "agent_message":
			return { kind: "message" as const, label: "Agente", detail: item.text };
		case "command_execution":
			return { kind: "tool" as const, label: "Terminal", detail: item.command };
		case "file_change":
			return {
				kind: "tool" as const,
				label: "Alterar arquivos",
				detail: describeCodexChanges(item),
			};
		case "mcp_tool_call":
			return {
				kind: "tool" as const,
				label: "Ferramenta MCP",
				detail: [item.server, item.tool].filter(Boolean).join(" · "),
			};
		case "web_search":
			return { kind: "tool" as const, label: "Pesquisar na web", detail: item.query };
		case "todo_list":
			return { kind: "notice" as const, label: "Atualizar plano", detail: item.text };
		case "error":
			return { kind: "notice" as const, label: "Erro", detail: item.text };
		default:
			return { kind: "notice" as const, label: item.type, detail: item.text };
	}
}

function codexPatches(
	raw: unknown,
	state: AgentStreamResult,
	started: Set<string>,
): AgentStepPatch[] {
	const parsed = CodexEventSchema.safeParse(raw);
	if (!parsed.success) {
		return [];
	}

	const event = parsed.data;
	if (event.type === "thread.started" && event.thread_id) {
		state.sessionId = event.thread_id;

		return [{ type: "append", step: { kind: "notice", label: "Sessão iniciada", status: "ok" } }];
	}

	if (event.type === "error") {
		const detail = trim(event.error?.message);

		return [
			{
				type: "append",
				step: { kind: "notice", label: "Erro", status: "error", ...(detail ? { detail } : {}) },
			},
		];
	}

	if (!event.item) {
		return [];
	}

	const described = describeCodexItem(event.item);
	const detail = trim(described.detail, described.kind === "message" ? 600 : DETAIL_MAX_CHARS);

	if (event.type === "item.started") {
		return [
			{
				type: "append",
				...(event.item.id ? { ref: event.item.id } : {}),
				step: {
					kind: described.kind,
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

	if (event.item.type === "agent_message" && event.item.text) {
		state.output = event.item.text;
	}

	const failed = event.item.status === "failed" || (event.item.exit_code ?? 0) !== 0;
	const status: AgentStepStatus = failed ? "error" : "ok";

	// O item já anunciado em `item.started` só muda de estado; o que aparece direto como concluído
	// (mensagem do agente, plano) entra como passo novo.
	if (event.item.id && started.has(event.item.id)) {
		return [{ type: "settle", ref: event.item.id, status, ...(detail ? { detail } : {}) }];
	}

	return [
		{
			type: "append",
			step: {
				kind: described.kind,
				label: described.label,
				status,
				...(detail ? { detail } : {}),
			},
		},
	];
}

// Um parser por execução: os CLIs entregam JSONL em pedaços arbitrários, então a linha parcial de um
// chunk precisa esperar o próximo. O mesmo parser serve ao acompanhamento ao vivo e ao desfecho —
// `result()` devolve o texto final e o id de sessão que o CLI anunciou pelo caminho.
export function createAgentStreamParser(cli: InvokeCli) {
	const state: AgentStreamResult = {};
	// Codex anuncia o mesmo item duas vezes, em `item.started` e em `item.completed`. Sem esta memória
	// o passo aparecia duplicado na conversa: uma vez rodando e outra concluído.
	const started = new Set<string>();
	let pending = "";

	function line(value: string): AgentStepPatch[] {
		const raw = parseJsonLine(value);
		if (!raw) {
			return [];
		}

		const patches = cli === "codex" ? codexPatches(raw, state, started) : claudePatches(raw, state);
		for (const patch of patches) {
			if (patch.type === "append" && patch.ref) {
				started.add(patch.ref);
			}
		}

		return patches;
	}

	return {
		push(chunk: string): AgentStepPatch[] {
			const lines = `${pending}${chunk}`.split("\n");
			pending = lines.pop() ?? "";

			return lines.flatMap(line);
		},
		flush(): AgentStepPatch[] {
			const rest = pending;
			pending = "";

			return line(rest);
		},
		result(): AgentStreamResult {
			return state;
		},
	};
}

// O acompanhamento ao vivo chega por partes e uma reconexão pode reentregar passos já conhecidos: a
// identidade é o `seq`, então reaplicar o mesmo lote não duplica nada e um passo que mudou de estado
// substitui a versão antiga.
export function mergeAgentSteps(current: AgentStep[], incoming: AgentStep[]) {
	if (incoming.length === 0) {
		return current;
	}

	const bySeq = new Map(current.map((step) => [step.seq, step]));
	for (const step of incoming) {
		bySeq.set(step.seq, step);
	}

	return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}
