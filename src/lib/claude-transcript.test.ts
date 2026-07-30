import { describe, expect, test } from "bun:test";

import { translateClaudeTranscriptLine } from "./claude-transcript";

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
