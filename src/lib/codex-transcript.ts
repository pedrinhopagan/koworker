import { z } from "zod";

import { trim } from "@/lib/agent-stream";
import type { TranscriptPatch } from "@/lib/agent-transcript";

const DETAIL_MAX_CHARS = 400;

// O rollout que o `codex` grava em `~/.codex/sessions` mistura três coisas na mesma linha: o evento
// da interface (`event_msg`), o item cru do modelo (`response_item`) e a configuração do turno. A
// conversa está no primeiro; a ferramenta e o resultado dela, no segundo.
const TranscriptContentSchema = z.array(
	z.object({ type: z.string(), text: z.string().optional() }).passthrough(),
);

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
		duration_ms: z.number().optional(),
		item: z
			.object({
				type: z.string(),
				id: z.string().optional(),
				content: TranscriptContentSchema.optional(),
				questions: z.unknown().optional(),
			})
			.optional(),
	}),
});

const QuestionListSchema = z.array(
	z.object({
		id: z.string().optional(),
		title: z.string().optional(),
		question: z.string().optional(),
		options: z
			.array(
				z.union([z.string(), z.object({ label: z.string(), description: z.string().optional() })]),
			)
			.optional(),
	}),
);

const QuestionArgumentsSchema = z.object({ questions: QuestionListSchema });

const AnswersOutputSchema = z.object({
	answers: z.record(z.string(), z.object({ answers: z.array(z.string()) })),
});

const ASYNC_QUESTION_TOOL = "request_user_input_async";
const BLOCKING_QUESTION_TOOL = "request_user_input";

function parseJson(raw: unknown) {
	if (typeof raw !== "string") {
		return null;
	}

	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return null;
	}
}

function questionPatches(
	toolUseId: string,
	questions: z.infer<typeof QuestionListSchema>,
	async: boolean,
) {
	return questions.flatMap((entry, index) => {
		const question = (entry.question ?? entry.title)?.trim();
		if (!question) {
			return [];
		}

		const questionId = questions.length === 1 ? toolUseId : `${toolUseId}#${index}`;

		return [
			{
				entry,
				question,
				questionId,
				patch: {
					type: "append",
					payload: {
						kind: "question",
						questionId,
						question,
						options: (entry.options ?? []).map((option) =>
							typeof option === "string" ? { label: option } : option,
						),
						multiSelect: false,
						...(async ? { async: true } : {}),
					},
				} satisfies TranscriptPatch,
			},
		];
	});
}

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

// O `turn_context` que o codex grava a cada turno carrega o modelo em vigor; um `/model` no meio da
// conversa aparece no turno seguinte.
const CodexModelLineSchema = z.object({
	type: z.string(),
	payload: z
		.object({
			type: z.string().optional(),
			model: z.string().optional(),
			effort: z.string().optional(),
			thread_settings: z
				.object({ model: z.string().optional(), reasoning_effort: z.string().optional() })
				.optional(),
		})
		.optional(),
});

function codexModelSettings(raw: unknown) {
	const parsed = CodexModelLineSchema.safeParse(raw);
	if (!parsed.success) {
		return null;
	}

	const { type, payload } = parsed.data;
	if (type === "turn_context") {
		return { model: payload?.model, effort: payload?.effort };
	}

	if (type === "event_msg" && payload?.type === "thread_settings_applied") {
		return {
			model: payload.thread_settings?.model,
			effort: payload.thread_settings?.reasoning_effort,
		};
	}

	return null;
}

export function codexTranscriptModel(raw: unknown): string | null {
	return codexModelSettings(raw)?.model?.trim() || null;
}

export function codexTranscriptEffort(raw: unknown): string | null {
	return codexModelSettings(raw)?.effort?.trim() || null;
}

// O rollout anuncia a fala de dois jeitos conforme a versão do codex: os novos usam `item_completed`
// com `UserMessage`/`AgentMessage`; os velhos, `user_message`/`agent_message`. Um arquivo que emitisse
// os dois para a mesma mensagem virava bloco duplicado, então, visto o formato novo, o legado é
// ignorado até o fim da leitura. O estado vive por arquivo e morre no reset da leitura.
export function createCodexTranscriptTranslator() {
	let itemMessagesSeen = false;
	let asyncCalls = new Set<string>();
	let pendingAsync = new Map<string, { toolUseId: string; questionId: string }>();
	let blockingCalls = new Map<string, Map<string, string>>();

	function asyncAnswers(text: string) {
		const answers = new Map<string, string[]>();
		const rest: string[] = [];
		let current: string | null = null;

		for (const line of text.split("\n")) {
			const title = line.startsWith("> ") ? line.slice(2).trim() : null;
			if (title !== null && pendingAsync.has(title)) {
				current = title;
				answers.set(title, []);
				continue;
			}

			(current ? (answers.get(current) ?? []) : rest).push(line);
		}

		const patches = [...answers].flatMap(([title, lines]): TranscriptPatch[] => {
			const answer = lines.join("\n").trim();
			const pending = pendingAsync.get(title);
			if (!answer || !pending) {
				return [];
			}

			pendingAsync.delete(title);

			return [{ type: "answer", ...pending, text: answer }];
		});

		return { patches, rest: patches.length > 0 ? rest.join("\n").trim() : text };
	}

	function blockingAnswers(callId: string, output: unknown): TranscriptPatch[] {
		const ids = blockingCalls.get(callId);
		blockingCalls.delete(callId);
		const parsed = AnswersOutputSchema.safeParse(parseJson(output));
		if (!ids || !parsed.success) {
			return [];
		}

		return Object.entries(parsed.data.answers).flatMap(([id, entry]): TranscriptPatch[] => {
			const questionId = ids.get(id);
			const text = entry.answers.join(", ");

			return questionId && text ? [{ type: "answer", toolUseId: callId, questionId, text }] : [];
		});
	}

	function translate(raw: unknown): TranscriptPatch[] {
		const parsed = RolloutLineSchema.safeParse(raw);
		if (!parsed.success) {
			return [];
		}

		const { type, payload } = parsed.data;
		if (type === "compacted") {
			return [
				{
					type: "append",
					payload: {
						kind: "notice",
						label: "Contexto compactado",
						detail: "O agente resumiu o contexto e continuou nesta mesma sessão.",
						tone: "info",
					},
				},
			];
		}

		if (type === "event_msg") {
			// O `/model` do TUI grava a troca na hora; virar aviso é o que faz a conversa (e o seletor)
			// saber dela antes do próximo turno.
			const settings = payload.type === "thread_settings_applied" ? codexModelSettings(raw) : null;
			if (settings?.model) {
				return [
					{
						type: "append",
						payload: {
							kind: "notice",
							label: "Modelo trocado",
							detail: [settings.model, settings.effort].filter(Boolean).join(" · "),
							tone: "info",
						},
					},
				];
			}
			if (payload.type === "item_completed" && payload.item) {
				const text = payload.item.content
					?.filter((block) => block.text?.trim())
					.map((block) => block.text)
					.join("\n\n");
				const images = payload.item.content?.filter((block) => block.type === "image").length ?? 0;

				if (payload.item.type === "UserMessage" && (text || images > 0)) {
					itemMessagesSeen = true;
					const { patches, rest } = text?.startsWith("> ")
						? asyncAnswers(text)
						: { patches: [], rest: text };
					if (patches.length > 0 && !rest && images === 0) {
						return patches;
					}

					return [
						...patches,
						{
							type: "append",
							payload: {
								kind: "user",
								text: rest || (images === 1 ? "Imagem enviada" : `${images} imagens enviadas`),
								...(images > 0 ? { images } : {}),
							},
						},
					];
				}

				const asyncQuestions = QuestionListSchema.safeParse(payload.item.questions);
				if (
					payload.item.type === "AgentMessage" &&
					payload.item.id &&
					asyncQuestions.success &&
					asyncQuestions.data.length > 0
				) {
					itemMessagesSeen = true;
					const questions = questionPatches(payload.item.id, asyncQuestions.data, true);
					for (const { question, questionId } of questions) {
						pendingAsync.set(question, { toolUseId: payload.item.id, questionId });
					}

					return questions.map(({ patch }) => patch);
				}

				if (payload.item.type === "AgentMessage" && text) {
					itemMessagesSeen = true;

					return [{ type: "append", payload: { kind: "assistant", text } }];
				}
			}

			if (!itemMessagesSeen && payload.type === "user_message" && payload.message?.trim()) {
				return [{ type: "append", payload: { kind: "user", text: payload.message } }];
			}

			if (!itemMessagesSeen && payload.type === "agent_message" && payload.message?.trim()) {
				return [{ type: "append", payload: { kind: "assistant", text: payload.message } }];
			}

			// O raciocínio só aparece quando o modelo o entrega em texto: o `response_item` guarda a versão
			// cifrada, que não é legível para ninguém.
			if (payload.type === "agent_reasoning" && payload.text?.trim()) {
				return [{ type: "append", payload: { kind: "thinking", text: payload.text } }];
			}

			if (payload.type === "task_complete" || payload.type === "turn_aborted") {
				return [
					{
						type: "result",
						status: payload.type === "task_complete" ? "done" : "cancelled",
						...(payload.duration_ms ? { durationMs: payload.duration_ms } : {}),
					},
				];
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

		if (payload.type === "function_call" && payload.call_id) {
			if (payload.name === ASYNC_QUESTION_TOOL) {
				asyncCalls.add(payload.call_id);

				return [];
			}

			if (payload.name === BLOCKING_QUESTION_TOOL) {
				const parsedArguments = QuestionArgumentsSchema.safeParse(parseJson(payload.arguments));
				const questions = parsedArguments.success
					? questionPatches(payload.call_id, parsedArguments.data.questions, false)
					: [];
				blockingCalls.set(
					payload.call_id,
					new Map(
						questions.flatMap(({ entry, questionId }) =>
							entry.id ? [[entry.id, questionId] as const] : [],
						),
					),
				);

				return questions.map(({ patch }) => patch);
			}
		}

		if (payload.type === "function_call" || payload.type === "custom_tool_call") {
			return toolPatch(payload);
		}

		if (payload.type === "function_call_output" && payload.call_id) {
			if (asyncCalls.delete(payload.call_id)) {
				return [];
			}

			if (blockingCalls.has(payload.call_id)) {
				return blockingAnswers(payload.call_id, payload.output);
			}
		}

		if (payload.type === "function_call_output" || payload.type === "custom_tool_call_output") {
			return outputPatch(payload);
		}

		return [];
	}

	return {
		translate,
		reset() {
			itemMessagesSeen = false;
			asyncCalls = new Set();
			pendingAsync = new Map();
			blockingCalls = new Map();
		},
	};
}

export function translateCodexTranscriptLine(raw: unknown): TranscriptPatch[] {
	return createCodexTranscriptTranslator().translate(raw);
}
