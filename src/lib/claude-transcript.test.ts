import { describe, expect, test } from "bun:test";

import { claudeTranscriptModel, translateClaudeTranscriptLine } from "./claude-transcript";

describe("translateClaudeTranscriptLine", () => {
	test("a fala do usuário é o texto puro da linha", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "user",
				isSidechain: false,
				message: { role: "user", content: "Corrija os acentos na digitação" },
				cwd: "/mnt/data/Projects/grind",
			}),
		).toEqual([
			{ type: "append", payload: { kind: "user", text: "Corrija os acentos na digitação" } },
		]);
	});

	test("preserva fala do usuário que veio com imagem em blocos", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "user",
				isSidechain: false,
				message: {
					role: "user",
					content: [
						{ type: "text", text: "Corrija o gráfico desta tela" },
						{ type: "image", source: { type: "base64", data: "..." } },
					],
				},
			}),
		).toEqual([
			{
				type: "append",
				payload: { kind: "user", text: "Corrija o gráfico desta tela", images: 1 },
			},
		]);
	});

	test("o comando de skill vira o que o usuário leria: nome mais argumentos", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "user",
				message: {
					role: "user",
					content:
						"<command-message>kw</command-message>\n<command-name>/kw</command-name>\n<command-args>Execute o plano</command-args>",
				},
			}),
		).toEqual([{ type: "append", payload: { kind: "user", text: "/kw Execute o plano" } }]);
	});

	test("o lembrete de sistema sai da fala", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "user",
				message: {
					role: "user",
					content: "Suba o servidor<system-reminder>não responda a este lembrete</system-reminder>",
				},
			}),
		).toEqual([{ type: "append", payload: { kind: "user", text: "Suba o servidor" } }]);
	});

	test("injeção do próprio CLI e bloco de subagente ficam fora da conversa", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "user",
				isMeta: true,
				message: { role: "user", content: "<local-command-caveat>Caveat…</local-command-caveat>" },
			}),
		).toEqual([]);

		expect(
			translateClaudeTranscriptLine({
				type: "assistant",
				isSidechain: true,
				message: { content: [{ type: "text", text: "resposta do subagente" }] },
			}),
		).toEqual([]);
	});

	test("o resumo automático da compactação não se passa pelo usuário", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "user",
				isCompactSummary: true,
				message: { role: "user", content: "This session is being continued..." },
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
	});

	test("o turno do agente vira fala e ferramenta, e o resultado fecha a ferramenta", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "assistant",
				isSidechain: false,
				message: {
					model: "claude-opus-5",
					content: [
						{ type: "text", text: "Vou ler o arquivo." },
						{
							type: "tool_use",
							id: "toolu_1",
							name: "Read",
							input: { file_path: "/repo/src/app.ts" },
						},
					],
				},
			}),
		).toEqual([
			{ type: "append", payload: { kind: "assistant", text: "Vou ler o arquivo." } },
			{
				type: "append",
				payload: {
					kind: "tool_use",
					name: "Read",
					label: "Ler arquivo",
					status: "running",
					toolUseId: "toolu_1",
					detail: "/repo/src/app.ts",
				},
			},
		]);

		expect(
			translateClaudeTranscriptLine({
				type: "user",
				message: {
					role: "user",
					content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "1\timport…" }],
				},
				toolUseResult: { filePath: "/repo/src/app.ts" },
			}),
		).toEqual([{ type: "settle", toolUseId: "toolu_1", ok: true }]);
	});

	test("AskUserQuestion vira bloco de pergunta com as opções, não passo de ferramenta", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "assistant",
				message: {
					model: "claude-opus-5",
					content: [
						{
							type: "tool_use",
							id: "toolu_q",
							name: "AskUserQuestion",
							input: {
								questions: [
									{
										question: "Qual direção seguir?",
										header: "Direção",
										multiSelect: false,
										options: [{ label: "Neutro", description: "Risco zero" }, { label: "Radical" }],
									},
								],
							},
						},
					],
				},
			}),
		).toEqual([
			{
				type: "append",
				payload: {
					kind: "question",
					questionId: "toolu_q",
					question: "Qual direção seguir?",
					options: [{ label: "Neutro", description: "Risco zero" }, { label: "Radical" }],
					multiSelect: false,
				},
			},
		]);
	});

	test("a resposta do usuário à pergunta vira patch de answer", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "user",
				message: {
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "toolu_q",
							content:
								'The user answered: "Qual direção seguir?"="Neutro". Read the answers carefully — follow what they actually say.',
						},
					],
				},
			}),
		).toEqual([
			{ type: "answer", toolUseId: "toolu_q", text: '"Qual direção seguir?"="Neutro".' },
			{ type: "settle", toolUseId: "toolu_q", ok: true },
		]);
	});

	test("o modelo sai da linha assistant e ignora resposta sintética e subagente", () => {
		expect(
			claudeTranscriptModel({
				type: "assistant",
				message: { model: "claude-opus-5", content: [] },
			}),
		).toBe("claude-opus-5");
		expect(
			claudeTranscriptModel({ type: "assistant", message: { model: "<synthetic>", content: [] } }),
		).toBeNull();
		expect(
			claudeTranscriptModel({
				type: "assistant",
				isSidechain: true,
				message: { model: "claude-haiku-4-5-20251001", content: [] },
			}),
		).toBeNull();
		expect(claudeTranscriptModel({ type: "user", message: { content: "oi" } })).toBeNull();
	});

	test("linha de serviço do arquivo não vira bloco", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "queue-operation",
				operation: "enqueue",
				content: "/kw Execute o plano",
			}),
		).toEqual([]);

		expect(
			translateClaudeTranscriptLine({ type: "attachment", attachment: { type: "hook_success" } }),
		).toEqual([]);
	});
});
