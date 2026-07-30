import { describe, expect, test } from "bun:test";

import { createCodexSessionParser, translateCodexLine } from "./codex-session-stream";

describe("translateCodexLine", () => {
	test("a primeira linha entrega a thread que o resume vai exigir", () => {
		expect(
			translateCodexLine({ type: "thread.started", thread_id: "019f-abc" }, new Set()),
		).toEqual([{ type: "cliSession", cliSessionId: "019f-abc" }]);
	});

	test("fala e raciocínio entram inteiros, sem o corte dos passos", () => {
		const text = "a".repeat(900);

		expect(
			translateCodexLine(
				{ type: "item.completed", item: { id: "item_0", type: "agent_message", text } },
				new Set(),
			),
		).toEqual([{ type: "append", payload: { kind: "assistant", text } }]);
		expect(
			translateCodexLine(
				{ type: "item.completed", item: { id: "item_1", type: "reasoning", text: "pensando" } },
				new Set(),
			),
		).toEqual([{ type: "append", payload: { kind: "thinking", text: "pensando" } }]);
	});

	test("o comando abre rodando e o mesmo item fecha o bloco em vez de duplicar", () => {
		const started = new Set<string>();

		expect(
			translateCodexLine(
				{
					type: "item.started",
					item: {
						id: "item_1",
						type: "command_execution",
						command: "bun test",
						status: "in_progress",
					},
				},
				started,
			),
		).toEqual([
			{
				type: "append",
				payload: {
					kind: "tool_use",
					toolUseId: "item_1",
					name: "command_execution",
					label: "Terminal",
					status: "running",
					detail: "bun test",
				},
			},
		]);

		expect(
			translateCodexLine(
				{
					type: "item.completed",
					item: {
						id: "item_1",
						type: "command_execution",
						command: "bun test",
						exit_code: 1,
						status: "completed",
					},
				},
				started,
			),
		).toEqual([{ type: "settle", toolUseId: "item_1", ok: false, detail: "bun test" }]);
	});

	// Um item que nunca foi anunciado como rodando não pode virar `settle`: o bloco não existe e a
	// ferramenta sumiria da conversa.
	test("item concluído sem abertura entra como bloco novo", () => {
		expect(
			translateCodexLine(
				{
					type: "item.completed",
					item: { id: "item_9", type: "web_search", query: "bun spawn stdin" },
				},
				new Set(),
			),
		).toEqual([
			{
				type: "append",
				payload: {
					kind: "tool_use",
					toolUseId: "item_9",
					name: "web_search",
					label: "Pesquisar na web",
					status: "ok",
					detail: "bun spawn stdin",
				},
			},
		]);
	});

	test("o turno fecha com desfecho próprio", () => {
		expect(translateCodexLine({ type: "turn.completed" }, new Set())).toEqual([
			{ type: "result", status: "done" },
		]);
		expect(
			translateCodexLine({ type: "error", error: { message: "sem crédito" } }, new Set()),
		).toEqual([{ type: "result", status: "failed", error: "sem crédito" }]);
	});
});

describe("createCodexSessionParser", () => {
	test("uma linha partida entre dois chunks só é traduzida quando completa", () => {
		const parser = createCodexSessionParser();
		const line = JSON.stringify({ type: "thread.started", thread_id: "019f-abc" });

		expect(parser.push(line.slice(0, 12))).toEqual([]);
		expect(parser.push(`${line.slice(12)}\n`)).toEqual([
			{ type: "cliSession", cliSessionId: "019f-abc" },
		]);
	});

	test("o parser lembra do item aberto entre chunks diferentes", () => {
		const parser = createCodexSessionParser();

		parser.push(
			`${JSON.stringify({
				type: "item.started",
				item: { id: "item_1", type: "command_execution", command: "ls" },
			})}\n`,
		);

		expect(
			parser.push(
				`${JSON.stringify({
					type: "item.completed",
					item: { id: "item_1", type: "command_execution", command: "ls", exit_code: 0 },
				})}\n`,
			),
		).toEqual([{ type: "settle", toolUseId: "item_1", ok: true, detail: "ls" }]);
	});

	test("linha inválida é ignorada em vez de derrubar a leitura", () => {
		const parser = createCodexSessionParser();

		expect(parser.push("nao é json\n")).toEqual([]);
		expect(parser.flush()).toEqual([]);
	});
});
