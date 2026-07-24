import { beforeAll, describe, expect, test } from "bun:test";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "prompt-run-test-secret";
process.env.NODE_ENV = "development";

let parseCodexOutput: typeof import("./prompt-run").parseCodexOutput;

beforeAll(async () => {
	({ parseCodexOutput } = await import("./prompt-run"));
});

describe("parseCodexOutput", () => {
	test("extrai a sessão e a mensagem final do JSONL", () => {
		const result = parseCodexOutput(
			[
				JSON.stringify({ type: "thread.started", thread_id: "thread-123" }),
				JSON.stringify({
					type: "item.completed",
					item: { type: "agent_message", text: "# Resultado\n\nTudo certo." },
				}),
			].join("\n"),
		);

		expect(result).toEqual({
			output: "# Resultado\n\nTudo certo.",
			cliSessionId: "thread-123",
		});
	});

	test("ignora eventos inválidos sem perder o resultado válido", () => {
		const result = parseCodexOutput(
			[
				"linha inválida",
				JSON.stringify({ type: "thread.started", thread_id: "thread-456" }),
				JSON.stringify({
					type: "item.completed",
					item: { type: "agent_message", text: "Resposta" },
				}),
			].join("\n"),
		);

		expect(result.output).toBe("Resposta");
		expect(result.cliSessionId).toBe("thread-456");
	});
});
