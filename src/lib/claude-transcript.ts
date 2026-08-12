import { z } from "zod";

import type { TranscriptPatch } from "@/lib/agent-transcript";
import { translateClaudeLine } from "@/lib/claude-session-stream";

// O arquivo que o `claude` grava em `~/.claude/projects` é a mesma conversa do stdout mais o que o
// CLI escreve só para si: injeção de contexto, anexo de hook, fila de prompt e blocos de subagente.
const TranscriptLineSchema = z.object({
	type: z.string().optional(),
	isSidechain: z.boolean().optional(),
	isMeta: z.boolean().optional(),
	isCompactSummary: z.boolean().optional(),
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
		(patch): patch is Extract<TranscriptPatch, { type: "append" | "settle" | "result" }> =>
			patch.type !== "permission" && patch.type !== "cliSession",
	);
}

const SYSTEM_REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g;
const COMMAND_NAME = /<command-name>([\s\S]*?)<\/command-name>/;
const COMMAND_ARGS = /<command-args>([\s\S]*?)<\/command-args>/;

// O que o usuário digitou chega embrulhado: lembrete de sistema que ele nunca viu e, quando é uma
// skill, a marcação do comando. Na tela do celular tem que aparecer o que ele leria no terminal.
function userText(raw: string) {
	const clean = raw.replaceAll(SYSTEM_REMINDER, "").trim();
	const args = COMMAND_ARGS.exec(clean);

	if (!args) {
		return clean;
	}

	return [COMMAND_NAME.exec(clean)?.[1]?.trim(), args[1]?.trim()].filter(Boolean).join(" ");
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

// O modelo que respondeu por último é o modelo da sessão: cada linha `assistant` o carrega, e um
// `/model` no meio da conversa troca o valor dali em diante. `<synthetic>` é resposta do próprio CLI.
export function claudeTranscriptModel(raw: unknown): string | null {
	const parsed = TranscriptLineSchema.safeParse(raw);
	if (!parsed.success || parsed.data.type !== "assistant" || parsed.data.isSidechain) {
		return null;
	}

	const model = parsed.data.message?.model;

	return model && model !== "<synthetic>" ? model : null;
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
			const text = userText(line.message.content);

			return text ? [{ type: "append", payload: { kind: "user", text } }] : [];
		}

		const answers = answerPatches(line.message?.content);
		if (answers.length > 0) {
			// A mesma linha pode carregar outros `tool_result`: os settles seguem valendo, e o settle do
			// próprio AskUserQuestion é ignorado pelo espelho porque a pergunta não é ferramenta aberta.
			return [...answers, ...streamPatches(raw)];
		}

		const blocks = UserContentBlocksSchema.safeParse(line.message?.content);
		if (blocks.success && !blocks.data.some((block) => block.type === "tool_result")) {
			const text = userText(
				blocks.data
					.filter((block) => block.type === "text" && block.text?.trim())
					.map((block) => block.text)
					.join("\n\n"),
			);
			const images = blocks.data.filter((block) => block.type === "image").length;

			if (text || images > 0) {
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
