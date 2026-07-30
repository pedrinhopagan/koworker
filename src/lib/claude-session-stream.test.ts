import { describe, expect, test } from "bun:test";

import { createClaudeSessionParser, translateClaudeLine } from "./claude-session-stream";

describe("translateClaudeLine", () => {
	test("separa fala, pensamento e ferramenta de um turno do agente", () => {
		const patches = translateClaudeLine({
			type: "assistant",
			message: {
				content: [
					{ type: "thinking", thinking: "preciso ler o arquivo" },
					{ type: "text", text: "Vou olhar o router." },
					{
						type: "tool_use",
						id: "toolu_1",
						name: "Read",
						input: { file_path: "/repo/src/api/router.ts" },
					},
				],
			},
		});

		expect(patches).toEqual([
			{ type: "append", payload: { kind: "thinking", text: "preciso ler o arquivo" } },
			{ type: "append", payload: { kind: "assistant", text: "Vou olhar o router." } },
			{
				type: "append",
				payload: {
					kind: "tool_use",
					name: "Read",
					label: "Ler arquivo",
					status: "running",
					toolUseId: "toolu_1",
					detail: "/repo/src/api/router.ts",
				},
			},
		]);
	});

	test("texto vazio do agente não vira bloco", () => {
		expect(
			translateClaudeLine({
				type: "assistant",
				message: { content: [{ type: "text", text: "  " }] },
			}),
		).toEqual([]);
	});

	test("resultado de ferramenta com erro fecha o bloco com o motivo", () => {
		expect(
			translateClaudeLine({
				type: "user",
				message: {
					content: [
						{
							type: "tool_result",
							tool_use_id: "toolu_1",
							is_error: true,
							content: "arquivo não encontrado",
						},
					],
				},
			}),
		).toEqual([
			{ type: "settle", toolUseId: "toolu_1", ok: false, detail: "arquivo não encontrado" },
		]);
	});

	test("pedido de permissão carrega o input para devolver ao liberar", () => {
		expect(
			translateClaudeLine({
				type: "control_request",
				request_id: "req-1",
				request: { subtype: "can_use_tool", tool_name: "Bash", input: { command: "rm -rf build" } },
			}),
		).toEqual([
			{
				type: "permission",
				requestId: "req-1",
				toolName: "Bash",
				label: "Terminal",
				input: { command: "rm -rf build" },
				detail: "rm -rf build",
			},
		]);
	});

	test("o desfecho do turno vem tanto por type quanto por subtype", () => {
		expect(translateClaudeLine({ type: "result", is_error: true, duration_ms: 10 })).toEqual([
			{ type: "result", status: "failed", durationMs: 10 },
		]);
		expect(translateClaudeLine({ subtype: "success", total_cost_usd: 0.5 })).toEqual([
			{ type: "result", status: "done", costUsd: 0.5 },
		]);
	});

	// O CLI reanuncia `system/init` a cada turno: virar bloco encheria a conversa de ruído.
	test("evento de sistema não vira bloco", () => {
		expect(
			translateClaudeLine({ type: "system", subtype: "init", model: "claude-opus-5" }),
		).toEqual([]);
	});
});

describe("createClaudeSessionParser", () => {
	test("uma linha partida entre dois chunks só é traduzida quando completa", () => {
		const parser = createClaudeSessionParser();
		const line = JSON.stringify({
			type: "assistant",
			message: { content: [{ type: "text", text: "oi" }] },
		});

		expect(parser.push(line.slice(0, 20))).toEqual([]);
		expect(parser.push(`${line.slice(20)}\n`)).toEqual([
			{ type: "append", payload: { kind: "assistant", text: "oi" } },
		]);
	});

	test("linha inválida é ignorada em vez de derrubar a leitura", () => {
		const parser = createClaudeSessionParser();

		expect(parser.push("nao é json\n")).toEqual([]);
		expect(parser.flush()).toEqual([]);
	});
});
