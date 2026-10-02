import { z } from "zod";

import { describeClaudeTool, trim } from "@/lib/agent-stream";
import type { TranscriptPatch } from "@/lib/agent-transcript";

const DETAIL_MAX_CHARS = 400;

const PiBlockSchema = z
	.object({
		type: z.string(),
		text: z.string().optional(),
		thinking: z.string().optional(),
		id: z.string().optional(),
		name: z.string().optional(),
		arguments: z.record(z.string(), z.unknown()).optional(),
	})
	.passthrough();

const PiContentSchema = z.union([z.string(), z.array(PiBlockSchema)]);

const PiMessageSchema = z
	.object({
		role: z.string(),
		content: PiContentSchema.optional(),
		model: z.string().optional(),
		stopReason: z.string().optional(),
		errorMessage: z.string().optional(),
		toolCallId: z.string().optional(),
		isError: z.boolean().optional(),
		command: z.string().optional(),
		exitCode: z.number().optional(),
		cancelled: z.boolean().optional(),
		customType: z.string().optional(),
		display: z.boolean().optional(),
	})
	.passthrough();

const PiLineSchema = z
	.object({
		type: z.string(),
		modelId: z.string().optional(),
		thinkingLevel: z.string().optional(),
		summary: z.string().optional(),
		customType: z.string().optional(),
		display: z.boolean().optional(),
		content: PiContentSchema.optional(),
		message: PiMessageSchema.optional(),
	})
	.passthrough();

const PI_CLAUDE_TOOLS: Record<string, string> = {
	read: "Read",
	bash: "Bash",
	edit: "Edit",
	write: "Write",
	grep: "Grep",
	find: "Glob",
};

type PiContent = z.infer<typeof PiContentSchema>;

function contentText(content: PiContent | undefined) {
	if (typeof content === "string") {
		return content.trim();
	}

	return (content ?? [])
		.filter((block) => block.type === "text" && block.text?.trim())
		.map((block) => block.text)
		.join("\n\n")
		.trim();
}

function notice(label: string, detail: string | undefined): TranscriptPatch[] {
	return [
		{
			type: "append",
			payload: { kind: "notice", label, tone: "info", ...(detail ? { detail } : {}) },
		},
	];
}

function customNotice(entry: {
	customType?: string;
	display?: boolean;
	content?: PiContent;
}): TranscriptPatch[] {
	if (!entry.display || !entry.customType) {
		return [];
	}

	return notice(entry.customType, trim(contentText(entry.content), DETAIL_MAX_CHARS));
}

function describePiTool(name: string, input: Record<string, unknown> | undefined) {
	if (name === "ls") {
		return {
			label: "Listar arquivos",
			detail: typeof input?.path === "string" ? input.path : undefined,
		};
	}

	return describeClaudeTool(PI_CLAUDE_TOOLS[name] ?? name, input);
}

function userPatch(content: PiContent | undefined): TranscriptPatch[] {
	const text = contentText(content);
	const images = Array.isArray(content)
		? content.filter((block) => block.type === "image").length
		: 0;

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

function blockPatch(block: z.infer<typeof PiBlockSchema>): TranscriptPatch[] {
	if (block.type === "thinking" && block.thinking?.trim()) {
		return [{ type: "append", payload: { kind: "thinking", text: block.thinking } }];
	}

	if (block.type === "text" && block.text?.trim()) {
		return [{ type: "append", payload: { kind: "assistant", text: block.text } }];
	}

	if (block.type !== "toolCall" || !block.id || !block.name) {
		return [];
	}

	const { label, detail } = describePiTool(block.name, block.arguments);
	const trimmed = trim(detail, DETAIL_MAX_CHARS);

	return [
		{
			type: "append",
			payload: {
				kind: "tool_use",
				toolUseId: block.id,
				name: block.name,
				label,
				status: "running",
				...(trimmed ? { detail: trimmed } : {}),
			},
		},
	];
}

function stopPatch(message: z.infer<typeof PiMessageSchema>): TranscriptPatch[] {
	if (message.stopReason === "stop") {
		return [{ type: "result", status: "done" }];
	}

	if (message.stopReason === "length") {
		return [
			{ type: "result", status: "failed", error: "A resposta foi cortada pelo limite de tokens." },
		];
	}

	if (message.stopReason === "aborted") {
		return [{ type: "result", status: "cancelled" }];
	}

	if (message.stopReason === "error") {
		const error = trim(message.errorMessage, DETAIL_MAX_CHARS);

		return [{ type: "result", status: "failed", ...(error ? { error } : {}) }];
	}

	return [];
}

function messagePatch(message: z.infer<typeof PiMessageSchema>): TranscriptPatch[] {
	if (message.role === "user") {
		return userPatch(message.content);
	}

	if (message.role === "assistant") {
		const blocks = Array.isArray(message.content) ? message.content : [];

		return [...blocks.flatMap(blockPatch), ...stopPatch(message)];
	}

	if (message.role === "toolResult") {
		if (!message.toolCallId) {
			return [];
		}

		const detail = message.isError
			? trim(contentText(message.content), DETAIL_MAX_CHARS)
			: undefined;

		return [
			{
				type: "settle",
				toolUseId: message.toolCallId,
				ok: !message.isError,
				...(detail ? { detail } : {}),
			},
		];
	}

	if (message.role === "bashExecution") {
		const detail = trim(message.command, DETAIL_MAX_CHARS);

		return [
			{
				type: "append",
				payload: {
					kind: "tool_use",
					name: "bash",
					label: "Terminal",
					status: message.exitCode === 0 && !message.cancelled ? "ok" : "error",
					...(detail ? { detail } : {}),
				},
			},
		];
	}

	if (message.role === "custom") {
		return customNotice(message);
	}

	return [];
}

export function translatePiTranscriptLine(raw: unknown): TranscriptPatch[] {
	const parsed = PiLineSchema.safeParse(raw);
	if (!parsed.success) {
		return [];
	}

	const line = parsed.data;

	if (line.type === "message" && line.message) {
		return messagePatch(line.message);
	}

	if (line.type === "compaction") {
		return notice(
			"Contexto compactado",
			"O agente resumiu o contexto e continuou nesta mesma sessão.",
		);
	}

	if (line.type === "branch_summary") {
		return notice("Conversa ramificada", trim(line.summary, DETAIL_MAX_CHARS));
	}

	if (line.type === "custom_message") {
		return customNotice(line);
	}

	return [];
}

export function piTranscriptModel(raw: unknown): string | null {
	const parsed = PiLineSchema.safeParse(raw);
	if (!parsed.success) {
		return null;
	}

	if (parsed.data.type === "model_change") {
		return parsed.data.modelId?.trim() || null;
	}

	if (parsed.data.type === "message" && parsed.data.message?.role === "assistant") {
		return parsed.data.message.model?.trim() || null;
	}

	return null;
}

export function piTranscriptEffort(raw: unknown): string | null {
	const parsed = PiLineSchema.safeParse(raw);
	if (!parsed.success || parsed.data.type !== "thinking_level_change") {
		return null;
	}

	return parsed.data.thinkingLevel?.trim() || null;
}
