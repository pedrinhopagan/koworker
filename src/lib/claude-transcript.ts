import { z } from "zod";

import type { AgentSessionPatch } from "@/lib/agent-session";
import type { TranscriptPatch } from "@/lib/agent-transcript";
import { claudeResultText, trim } from "@/lib/agent-stream";
import { translateClaudeLine } from "@/lib/claude-session-stream";

// O arquivo que o `claude` grava em `~/.claude/projects` é a mesma conversa do stdout mais o que o
// CLI escreve só para si: injeção de contexto, anexo de hook, fila de prompt e blocos de subagente.
const TranscriptLineSchema = z.object({
	type: z.string().optional(),
	isSidechain: z.boolean().optional(),
	isMeta: z.boolean().optional(),
	isCompactSummary: z.boolean().optional(),
	isApiErrorMessage: z.boolean().optional(),
	subtype: z.string().optional(),
	durationMs: z.number().optional(),
	operation: z.string().optional(),
	content: z.unknown().optional(),
	commandRun: z.object({ command: z.string().optional() }).optional(),
	attachment: z
		.object({
			type: z.string(),
			prompt: z.unknown().optional(),
			commandMode: z.string().optional(),
		})
		.optional(),
	effort: z.string().optional(),
	message: z.object({ content: z.unknown().optional(), model: z.string().optional() }).optional(),
});
const UserContentBlocksSchema = z.array(
	z.object({ type: z.string(), text: z.string().optional() }).passthrough(),
);
const ToolResultBlocksSchema = z.array(
	z
		.object({
			type: z.string(),
			tool_use_id: z.string().optional(),
			content: z.unknown().optional(),
		})
		.passthrough(),
);
const AskUserQuestionInputSchema = z.object({
	questions: z.array(
		z.object({
			question: z.string(),
			multiSelect: z.boolean().optional(),
			options: z
				.array(z.object({ label: z.string(), description: z.string().optional() }).passthrough())
				.default([]),
		}),
	),
});
const AssistantToolUseBlocksSchema = z.array(
	z
		.object({
			type: z.string(),
			id: z.string().optional(),
			name: z.string().optional(),
			input: z.unknown().optional(),
		})
		.passthrough(),
);

const ANSWER_PREFIX = /^The user answered:\s*/;
const ANSWER_SUFFIX = /\s*Read the answers carefully\b[\s\S]*$/;

// Permissão vem do canal de controle do stdout, não do arquivo; `cliSession` idem. O resto do stream
// é o mesmo shape do transcript.
function streamPatches(raw: unknown): TranscriptPatch[] {
	return translateClaudeLine(raw).filter(
		(patch): patch is Extract<AgentSessionPatch, { type: "append" | "settle" | "result" }> =>
			patch.type !== "permission" && patch.type !== "cliSession",
	);
}

const SYSTEM_REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g;
const COMMAND_NAME = /<command-name>([\s\S]*?)<\/command-name>/;
const COMMAND_ARGS = /<command-args>([\s\S]*?)<\/command-args>/;
const TASK_NOTIFICATION = /^\s*<task-notification>/;
const TASK_STATUS = /<status>([\s\S]*?)<\/status>/;
const TASK_SUMMARY = /<summary>([\s\S]*?)<\/summary>/;
const LOCAL_STDOUT = /<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/;
const LOCAL_STDERR = /<local-command-stderr>([\s\S]*?)<\/local-command-stderr>/;
const BASH_INPUT = /^\s*<bash-input>([\s\S]*?)<\/bash-input>\s*$/;
const BASH_OUTPUT = /^\s*<bash-(stdout|stderr)>([\s\S]*?)<\/bash-\1>/;
const INTERRUPTED = /^\[Request interrupted by user(?: for tool use)?\]$/;
const TASK_FAILED = new Set(["failed", "killed"]);

// O que o usuário digitou chega embrulhado: lembrete de sistema que ele nunca viu e, quando é uma
// skill, a marcação do comando. Na tela do celular tem que aparecer o que ele leria no terminal.
function userText(raw: string) {
	const clean = raw
		.replaceAll(SYSTEM_REMINDER, "")
		.replaceAll(/<pasted_content(?:\s[^>]*)?>([\s\S]*?)<\/pasted_content(?:\s[^>]*)?>/g, "$1")
		.trim();
	const args = COMMAND_ARGS.exec(clean);

	if (!args) {
		return clean;
	}

	return [COMMAND_NAME.exec(clean)?.[1]?.trim(), args[1]?.trim()].filter(Boolean).join(" ");
}

function taskNotificationPatch(raw: string): TranscriptPatch {
	const status = TASK_STATUS.exec(raw)?.[1]?.trim() ?? "";
	const summary = TASK_SUMMARY.exec(raw)?.[1]?.trim();
	const failed = TASK_FAILED.has(status);

	return {
		type: "append",
		payload: {
			kind: "notice",
			label: failed
				? "Tarefa em segundo plano falhou"
				: status === "completed"
					? "Tarefa em segundo plano concluída"
					: "Tarefa em segundo plano atualizada",
			...(summary ? { detail: summary } : {}),
			tone: failed ? "error" : "info",
		},
	};
}

function commandOutputPatch(label: string, output: string, failed: boolean): TranscriptPatch[] {
	const detail = Bun.stripANSI(output).trim();
	if (!detail) {
		return [];
	}

	return [
		{
			type: "append",
			payload: {
				kind: "notice",
				label,
				detail: trim(detail, 400),
				tone: failed ? "error" : "info",
			},
		},
	];
}

function queueText(raw: string) {
	return TASK_NOTIFICATION.test(raw) ? "" : userText(raw);
}

function userTextPatches(raw: string, images = 0): TranscriptPatch[] {
	if (TASK_NOTIFICATION.test(raw)) {
		return [taskNotificationPatch(raw)];
	}

	const stdout = LOCAL_STDOUT.exec(raw);
	const stderr = LOCAL_STDERR.exec(raw);
	if (stdout || stderr) {
		return commandOutputPatch("Saída do comando", stderr?.[1] ?? stdout?.[1] ?? "", !!stderr);
	}

	const bashOutput = BASH_OUTPUT.exec(raw);
	if (bashOutput) {
		return commandOutputPatch("Saída do terminal", bashOutput[2] ?? "", bashOutput[1] === "stderr");
	}

	const bashInput = BASH_INPUT.exec(raw)?.[1]?.trim();
	const text = bashInput ? `! ${bashInput}` : userText(raw);
	if (INTERRUPTED.test(text)) {
		return [{ type: "result", status: "cancelled" }];
	}
	if (!text && images === 0) {
		return [];
	}

	return [
		{
			type: "append",
			payload: {
				kind: "user",
				text: text || (images === 1 ? "Imagem enviada" : `${images} imagens enviadas`),
				...(images > 0 ? { images } : {}),
			},
		},
	];
}

// A pergunta estruturada do claude é um `tool_use` com as opções completas no input: virar bloco
// `question` é o que deixa o PWA mostrar o que o terminal está perguntando, em vez de esconder o
// seletor atrás de um passo de ferramenta.
function questionPatches(content: unknown): Map<string, TranscriptPatch[]> {
	const byToolUse = new Map<string, TranscriptPatch[]>();
	const blocks = AssistantToolUseBlocksSchema.safeParse(content);
	if (!blocks.success) {
		return byToolUse;
	}

	for (const block of blocks.data) {
		const toolUseId = block.id;
		if (block.type !== "tool_use" || block.name !== "AskUserQuestion" || !toolUseId) {
			continue;
		}

		const input = AskUserQuestionInputSchema.safeParse(block.input);
		if (!input.success) {
			continue;
		}

		const single = input.data.questions.length === 1;
		byToolUse.set(
			toolUseId,
			input.data.questions.map((entry, index) => ({
				type: "append",
				payload: {
					kind: "question",
					questionId: single ? toolUseId : `${toolUseId}#${index}`,
					question: entry.question,
					options: entry.options.map((option) => ({
						label: option.label,
						...(option.description ? { description: option.description } : {}),
					})),
					multiSelect: entry.multiSelect ?? false,
				},
			})),
		);
	}

	return byToolUse;
}

function answerPatches(content: unknown): TranscriptPatch[] {
	const blocks = ToolResultBlocksSchema.safeParse(content);
	if (!blocks.success) {
		return [];
	}

	return blocks.data.flatMap((block): TranscriptPatch[] => {
		if (
			block.type !== "tool_result" ||
			!block.tool_use_id ||
			typeof block.content !== "string" ||
			!ANSWER_PREFIX.test(block.content)
		) {
			return [];
		}

		const text = block.content.replace(ANSWER_PREFIX, "").replace(ANSWER_SUFFIX, "").trim();

		return text ? [{ type: "answer", toolUseId: block.tool_use_id, text }] : [];
	});
}

const MODEL_SET = /^Set model to `?([^`(\n]+?)`?(?= for | with |\s*\(|$)/;
const MODEL_SET_EFFORT = /^Set model to [^\n]*? with `?(\w+)`? effort/;
const EFFORT_SET = /^Set effort level to `?(\w+)`?/;

// O que um `/model` ou `/effort` digitado no terminal respondeu: é a troca valendo na hora, antes
// de qualquer resposta do modelo novo.
function localCommandOutput(parsed: z.infer<typeof TranscriptLineSchema>) {
	const content = parsed.type === "user" ? parsed.message?.content : undefined;

	return typeof content === "string" ? (LOCAL_STDOUT.exec(content)?.[1]?.trim() ?? null) : null;
}

// O modelo que respondeu por último é o modelo da sessão: cada linha `assistant` o carrega, e a
// saída de um `/model` troca o valor na hora (com o nome exibido, "Sonnet 5", que o seletor casa
// com o catálogo). `<synthetic>` é resposta do próprio CLI.
export function claudeTranscriptModel(raw: unknown): string | null {
	const parsed = TranscriptLineSchema.safeParse(raw);
	if (!parsed.success || parsed.data.isSidechain) {
		return null;
	}

	const output = localCommandOutput(parsed.data);
	if (output) {
		return MODEL_SET.exec(output)?.[1]?.trim() || null;
	}
	if (parsed.data.type !== "assistant") {
		return null;
	}

	const model = parsed.data.message?.model;

	return model && model !== "<synthetic>" ? model : null;
}

// O esforço viaja fora de `message`, na própria linha `assistant`; um `/effort` ou `/model` no meio
// da conversa o troca na hora pela saída do comando.
export function claudeTranscriptEffort(raw: unknown): string | null {
	const parsed = TranscriptLineSchema.safeParse(raw);
	if (!parsed.success || parsed.data.isSidechain) {
		return null;
	}

	const output = localCommandOutput(parsed.data);
	if (output) {
		return (MODEL_SET_EFFORT.exec(output) ?? EFFORT_SET.exec(output))?.[1]?.toLowerCase() ?? null;
	}
	if (parsed.data.type !== "assistant") {
		return null;
	}

	return parsed.data.effort?.trim() || null;
}

export function translateClaudeTranscriptLine(raw: unknown): TranscriptPatch[] {
	const parsed = TranscriptLineSchema.safeParse(raw);
	if (!parsed.success) {
		return [];
	}

	const line = parsed.data;
	if (line.isSidechain || line.isMeta) {
		return [];
	}
	if (line.type === "queue-operation") {
		const op = line.operation;
		if (op !== "enqueue" && op !== "dequeue" && op !== "remove") {
			return [];
		}

		return [
			{
				type: "queue",
				op,
				...(typeof line.content === "string" ? { text: queueText(line.content) } : {}),
			},
		];
	}
	if (line.type === "attachment") {
		const prompt = line.attachment?.prompt;
		if (line.attachment?.type !== "queued_command" || typeof prompt !== "string") {
			return [];
		}

		return line.attachment.commandMode === "task-notification"
			? [taskNotificationPatch(prompt)]
			: userTextPatches(prompt);
	}
	if (line.type === "system") {
		if (line.subtype === "turn_duration") {
			return [
				{
					type: "result",
					status: "done",
					...(line.durationMs ? { durationMs: line.durationMs } : {}),
				},
			];
		}
		if (line.subtype === "local_command" && typeof line.content === "string") {
			const command = line.commandRun?.command?.trim();
			const stderr = LOCAL_STDERR.exec(line.content)?.[1];

			return commandOutputPatch(
				command ? `Saída de /${command}` : "Saída do comando",
				stderr ?? LOCAL_STDOUT.exec(line.content)?.[1] ?? "",
				!!stderr,
			);
		}

		return [];
	}
	if (line.type === "assistant" && line.isApiErrorMessage) {
		const text = claudeResultText(line.message?.content)?.trim();

		return [
			{
				type: "append",
				payload: {
					kind: "notice",
					label: "Erro da API",
					...(text ? { detail: trim(text, 400) } : {}),
					tone: "error",
				},
			},
		];
	}
	if (line.isCompactSummary) {
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

	if (line.type === "user") {
		if (typeof line.message?.content === "string") {
			return userTextPatches(line.message.content);
		}

		const answers = answerPatches(line.message?.content);
		if (answers.length > 0) {
			// A mesma linha pode carregar outros `tool_result`: os settles seguem valendo, e o settle do
			// próprio AskUserQuestion é ignorado pelo espelho porque a pergunta não é ferramenta aberta.
			return [...answers, ...streamPatches(raw)];
		}

		const blocks = UserContentBlocksSchema.safeParse(line.message?.content);
		if (blocks.success && !blocks.data.some((block) => block.type === "tool_result")) {
			return userTextPatches(
				blocks.data
					.filter((block) => block.type === "text" && block.text?.trim())
					.map((block) => block.text)
					.join("\n\n"),
				blocks.data.filter((block) => block.type === "image").length,
			);
		}
	}

	const translated = streamPatches(raw);

	if (line.type !== "assistant") {
		return translated;
	}

	const questions = questionPatches(line.message?.content);
	if (questions.size === 0) {
		return translated;
	}

	return translated.flatMap((patch) => {
		if (
			patch.type === "append" &&
			patch.payload.kind === "tool_use" &&
			patch.payload.name === "AskUserQuestion" &&
			patch.payload.toolUseId
		) {
			return questions.get(patch.payload.toolUseId) ?? [patch];
		}

		return [patch];
	});
}
