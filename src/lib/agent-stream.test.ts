import { describe, expect, test } from "bun:test";

import { createAgentStreamParser, mergeAgentSteps, type AgentStep } from "./agent-stream";

function jsonl(...events: unknown[]) {
	return `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
}

describe("createAgentStreamParser · codex", () => {
	test("extrai a sessão e a mensagem final do JSONL", () => {
		const parser = createAgentStreamParser("codex");
		parser.push(
			jsonl(
				{ type: "thread.started", thread_id: "thread-123" },
				{ type: "item.completed", item: { type: "agent_message", text: "# Resultado" } },
			),
		);
		parser.flush();

		expect(parser.result()).toMatchObject({ output: "# Resultado", sessionId: "thread-123" });
	});

	test("ignora linhas inválidas sem perder o evento seguinte", () => {
		const parser = createAgentStreamParser("codex");
		parser.push(`linha inválida\n${jsonl({ type: "thread.started", thread_id: "thread-456" })}`);

		expect(parser.result().sessionId).toBe("thread-456");
	});

	test("descreve o comando executado e marca a falha pelo código de saída", () => {
		const parser = createAgentStreamParser("codex");
		const started = parser.push(
			jsonl({ type: "item.started", item: { id: "item_1", type: "command_execution" } }),
		);
		const completed = parser.push(
			jsonl({
				type: "item.completed",
				item: { id: "item_1", type: "command_execution", command: "bun test", exit_code: 1 },
			}),
		);

		expect(started).toEqual([
			{
				type: "append",
				ref: "item_1",
				step: { kind: "tool", label: "Terminal", status: "running" },
			},
		]);
		expect(completed).toEqual([
			{ type: "settle", ref: "item_1", status: "error", detail: "bun test" },
		]);
	});
});

describe("createAgentStreamParser · claude", () => {
	test("transforma o uso de ferramenta em passo com alvo e fecha no resultado", () => {
		const parser = createAgentStreamParser("claude");
		const use = parser.push(
			jsonl({
				type: "assistant",
				message: {
					content: [
						{ type: "tool_use", id: "toolu_1", name: "Edit", input: { file_path: "src/api.ts" } },
					],
				},
			}),
		);
		const result = parser.push(
			jsonl({
				type: "user",
				message: { content: [{ type: "tool_result", tool_use_id: "toolu_1" }] },
			}),
		);

		expect(use).toEqual([
			{
				type: "append",
				ref: "toolu_1",
				step: {
					kind: "tool",
					label: "Editar arquivo",
					status: "running",
					detail: "src/api.ts",
				},
			},
		]);
		expect(result).toEqual([{ type: "settle", ref: "toolu_1", status: "ok" }]);
	});

	test("usa o evento final como saída e sessão da execução", () => {
		const parser = createAgentStreamParser("claude");
		parser.push(
			jsonl({
				type: "result",
				subtype: "success",
				result: "Pronto",
				session_id: "sess-1",
				num_turns: 4,
			}),
		);

		expect(parser.result()).toMatchObject({ output: "Pronto", sessionId: "sess-1", turns: 4 });
	});

	test("remonta a linha partida entre dois pedaços do processo", () => {
		const parser = createAgentStreamParser("claude");
		const line = JSON.stringify({ type: "result", result: "Inteiro", session_id: "sess-2" });

		expect(parser.push(line.slice(0, 12))).toEqual([]);
		parser.push(`${line.slice(12)}\n`);

		expect(parser.result().output).toBe("Inteiro");
	});
});

describe("mergeAgentSteps", () => {
	test("substitui o passo reentregue e mantém a ordem por sequência", () => {
		const current: AgentStep[] = [
			{ seq: 1, kind: "tool", label: "Terminal", status: "running", at: 1 },
			{ seq: 2, kind: "message", label: "Agente", status: "ok", at: 2 },
		];

		expect(
			mergeAgentSteps(current, [{ seq: 1, kind: "tool", label: "Terminal", status: "ok", at: 3 }]),
		).toEqual([
			{ seq: 1, kind: "tool", label: "Terminal", status: "ok", at: 3 },
			{ seq: 2, kind: "message", label: "Agente", status: "ok", at: 2 },
		]);
	});
});
