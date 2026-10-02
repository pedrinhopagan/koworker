import { describe, expect, test } from "bun:test";

import { piTranscriptEffort, piTranscriptModel, translatePiTranscriptLine } from "./pi-transcript";

const TOOL_CALL_ID =
	"call_Ccg4ilyQdA6UgrxtGtsLgHb9|fc_0ffbbb7dc4c8f376016a56412616cc8191bea3d9b03b2289f3";

function assistantLine(message: Record<string, unknown>) {
	return {
		type: "message",
		id: "a1b2c3d4",
		parentId: "c917e355",
		timestamp: "2026-07-14T13:53:54.646Z",
		message: {
			role: "assistant",
			api: "openai-codex-responses",
			provider: "openai-codex",
			model: "gpt-5.6-sol",
			timestamp: 1784037481609,
			...message,
		},
	};
}

describe("translatePiTranscriptLine", () => {
	test("a fala do usuário aceita texto puro e blocos com imagem", () => {
		expect(
			translatePiTranscriptLine({
				type: "message",
				message: { role: "user", content: "  Ajuste o parallax do cenário  ", timestamp: 1 },
			}),
		).toEqual([
			{ type: "append", payload: { kind: "user", text: "Ajuste o parallax do cenário" } },
		]);

		expect(
			translatePiTranscriptLine({
				type: "message",
				message: {
					role: "user",
					content: [
						{ type: "text", text: "Olha esse print" },
						{ type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" },
						{ type: "text", text: "e esse também" },
						{ type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" },
					],
				},
			}),
		).toEqual([
			{
				type: "append",
				payload: { kind: "user", text: "Olha esse print\n\ne esse também", images: 2 },
			},
		]);

		expect(
			translatePiTranscriptLine({
				type: "message",
				message: {
					role: "user",
					content: [{ type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" }],
				},
			}),
		).toEqual([{ type: "append", payload: { kind: "user", text: "Imagem enviada", images: 1 } }]);

		expect(
			translatePiTranscriptLine({ type: "message", message: { role: "user", content: "   " } }),
		).toEqual([]);
	});

	test("a resposta do assistente sai em ordem: raciocínio, texto e ferramentas", () => {
		expect(
			translatePiTranscriptLine(
				assistantLine({
					stopReason: "toolUse",
					content: [
						{ type: "thinking", thinking: "**Inspecting skill keywords**", thinkingSignature: "x" },
						{ type: "thinking", thinking: "" },
						{ type: "text", text: "Vou procurar as skills." },
						{
							type: "toolCall",
							id: TOOL_CALL_ID,
							name: "bash",
							arguments: { command: "find ~/.agents/skills -name SKILL.md", timeout: 10 },
						},
						{ type: "toolCall", id: "t2", name: "read", arguments: { path: "src/api/router.ts" } },
						{ type: "toolCall", id: "t3", name: "find", arguments: { pattern: "**/*.ts" } },
						{ type: "toolCall", id: "t4", name: "ls", arguments: { path: "src/lib" } },
						{ type: "toolCall", id: "t5", name: "todo", arguments: {} },
					],
				}),
			),
		).toEqual([
			{ type: "append", payload: { kind: "thinking", text: "**Inspecting skill keywords**" } },
			{ type: "append", payload: { kind: "assistant", text: "Vou procurar as skills." } },
			{
				type: "append",
				payload: {
					kind: "tool_use",
					toolUseId: TOOL_CALL_ID,
					name: "bash",
					label: "Terminal",
					status: "running",
					detail: "find ~/.agents/skills -name SKILL.md",
				},
			},
			{
				type: "append",
				payload: {
					kind: "tool_use",
					toolUseId: "t2",
					name: "read",
					label: "Ler arquivo",
					status: "running",
					detail: "src/api/router.ts",
				},
			},
			{
				type: "append",
				payload: {
					kind: "tool_use",
					toolUseId: "t3",
					name: "find",
					label: "Listar arquivos",
					status: "running",
					detail: "**/*.ts",
				},
			},
			{
				type: "append",
				payload: {
					kind: "tool_use",
					toolUseId: "t4",
					name: "ls",
					label: "Listar arquivos",
					status: "running",
					detail: "src/lib",
				},
			},
			{
				type: "append",
				payload: {
					kind: "tool_use",
					toolUseId: "t5",
					name: "todo",
					label: "todo",
					status: "running",
				},
			},
		]);
	});

	test("o motivo de parada fecha o turno", () => {
		expect(
			translatePiTranscriptLine(
				assistantLine({
					stopReason: "stop",
					content: [{ type: "text", text: "Oi! Como posso ajudar?" }],
				}),
			),
		).toEqual([
			{ type: "append", payload: { kind: "assistant", text: "Oi! Como posso ajudar?" } },
			{ type: "result", status: "done" },
		]);

		expect(
			translatePiTranscriptLine(assistantLine({ stopReason: "aborted", content: [] })),
		).toEqual([{ type: "result", status: "cancelled" }]);

		expect(
			translatePiTranscriptLine(
				assistantLine({ stopReason: "error", errorMessage: "WebSocket error", content: [] }),
			),
		).toEqual([{ type: "result", status: "failed", error: "WebSocket error" }]);

		expect(translatePiTranscriptLine(assistantLine({ stopReason: "length", content: [] }))).toEqual(
			[
				{
					type: "result",
					status: "failed",
					error: "A resposta foi cortada pelo limite de tokens.",
				},
			],
		);
	});

	test("o resultado da ferramenta fecha o bloco e só o erro carrega detalhe", () => {
		expect(
			translatePiTranscriptLine({
				type: "message",
				message: {
					role: "toolResult",
					toolCallId: TOOL_CALL_ID,
					toolName: "bash",
					content: [{ type: "text", text: "SKILL.md" }],
					isError: false,
					timestamp: 1784037670263,
				},
			}),
		).toEqual([{ type: "settle", toolUseId: TOOL_CALL_ID, ok: true }]);

		expect(
			translatePiTranscriptLine({
				type: "message",
				message: {
					role: "toolResult",
					toolCallId: "t2",
					toolName: "read",
					content: [
						{ type: "text", text: "ENOENT: no such file" },
						{ type: "text", text: "src/api/router.ts" },
					],
					isError: true,
				},
			}),
		).toEqual([
			{
				type: "settle",
				toolUseId: "t2",
				ok: false,
				detail: "ENOENT: no such file src/api/router.ts",
			},
		]);
	});

	test("o comando digitado com ! vira um passo de terminal já concluído", () => {
		expect(
			translatePiTranscriptLine({
				type: "message",
				message: {
					role: "bashExecution",
					command: "git status",
					output: "On branch main",
					exitCode: 0,
					cancelled: false,
					truncated: false,
				},
			}),
		).toEqual([
			{
				type: "append",
				payload: {
					kind: "tool_use",
					name: "bash",
					label: "Terminal",
					detail: "git status",
					status: "ok",
				},
			},
		]);

		expect(
			translatePiTranscriptLine({
				type: "message",
				message: { role: "bashExecution", command: "false", exitCode: 1, cancelled: false },
			}),
		).toEqual([
			{
				type: "append",
				payload: {
					kind: "tool_use",
					name: "bash",
					label: "Terminal",
					detail: "false",
					status: "error",
				},
			},
		]);
	});

	test("compactação, ramificação e mensagens de extensão viram aviso", () => {
		expect(
			translatePiTranscriptLine({
				type: "compaction",
				summary: "Resumo",
				firstKeptEntryId: "c4d5e6f7",
				tokensBefore: 50000,
			}),
		).toEqual([
			{
				type: "append",
				payload: {
					kind: "notice",
					label: "Contexto compactado",
					detail: "O agente resumiu o contexto e continuou nesta mesma sessão.",
					tone: "info",
				},
			},
		]);

		expect(
			translatePiTranscriptLine({
				type: "branch_summary",
				fromId: "f6g7h8i9",
				summary: "Branch explored approach A...",
			}),
		).toEqual([
			{
				type: "append",
				payload: {
					kind: "notice",
					label: "Conversa ramificada",
					detail: "Branch explored approach A...",
					tone: "info",
				},
			},
		]);

		expect(
			translatePiTranscriptLine({
				type: "custom_message",
				customType: "my-extension",
				content: "Injected context...",
				display: true,
			}),
		).toEqual([
			{
				type: "append",
				payload: {
					kind: "notice",
					label: "my-extension",
					detail: "Injected context...",
					tone: "info",
				},
			},
		]);

		expect(
			translatePiTranscriptLine({
				type: "custom_message",
				customType: "my-extension",
				content: "Injected context...",
				display: false,
			}),
		).toEqual([]);
	});

	test("linhas de controle e desconhecidas não viram bloco", () => {
		for (const line of [
			{ type: "session", version: 3, id: "uuid", cwd: "/home/pedro" },
			{ type: "model_change", provider: "openai-codex", modelId: "gpt-5.5" },
			{ type: "thinking_level_change", thinkingLevel: "medium" },
			{ type: "label", targetId: "a1", label: "checkpoint" },
			{ type: "custom", customType: "my-extension", data: {} },
			{ type: "algo_novo" },
			"texto solto",
			null,
		]) {
			expect(translatePiTranscriptLine(line)).toEqual([]);
		}
	});
});

describe("piTranscriptModel e piTranscriptEffort", () => {
	test("modelo vem da troca de modelo e da resposta do assistente", () => {
		expect(
			piTranscriptModel({
				type: "model_change",
				id: "c917e355",
				provider: "openai-codex",
				modelId: "gpt-5.5",
			}),
		).toBe("gpt-5.5");
		expect(piTranscriptModel(assistantLine({ stopReason: "stop", content: [] }))).toBe(
			"gpt-5.6-sol",
		);
		expect(
			piTranscriptModel({ type: "message", message: { role: "user", content: "oi" } }),
		).toBeNull();
		expect(
			piTranscriptModel({ type: "thinking_level_change", thinkingLevel: "medium" }),
		).toBeNull();
	});

	test("esforço vem da troca de nível de raciocínio", () => {
		expect(
			piTranscriptEffort({
				type: "thinking_level_change",
				id: "d3b0e9a3",
				thinkingLevel: "medium",
			}),
		).toBe("medium");
		expect(piTranscriptEffort({ type: "model_change", modelId: "gpt-5.5" })).toBeNull();
	});
});
