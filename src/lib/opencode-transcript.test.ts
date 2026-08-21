import { describe, expect, test } from "bun:test";

import { createOpencodeTranscriptTranslator, type OpencodePartRow } from "./opencode-transcript";

function row(
	id: string,
	role: string,
	data: Record<string, unknown>,
	messageId = "msg_1",
): OpencodePartRow {
	return { id, messageId, role, data };
}

describe("createOpencodeTranscriptTranslator", () => {
	test("fala do usuário vira bloco uma vez só, mesmo em consulta repetida", () => {
		const translator = createOpencodeTranscriptTranslator();
		const rows = [row("p1", "user", { type: "text", text: "Ajuste o parallax" })];

		const first = translator.translate(rows);
		expect(first).toEqual([
			{ type: "append", payload: { kind: "user", text: "Ajuste o parallax" } },
		]);
		expect(translator.translate(rows)).toEqual([]);
	});

	test("resposta em andamento espera o fim do passo para virar bloco", () => {
		const translator = createOpencodeTranscriptTranslator();

		const streaming = translator.translate([
			row("p1", "assistant", { type: "text", text: "Vou revisar" }),
		]);
		expect(streaming).toEqual([]);

		const done = translator.translate([
			row("p1", "assistant", { type: "text", text: "Vou revisar", time: { end: 123 } }),
		]);
		expect(done).toEqual([{ type: "append", payload: { kind: "assistant", text: "Vou revisar" } }]);
	});

	test("raciocínio congela pelo step-finish da mesma mensagem quando não tem time.end", () => {
		const translator = createOpencodeTranscriptTranslator();

		const patches = translator.translate([
			row("r1", "assistant", { type: "reasoning", text: "Pensando o caminho" }),
			row("s1", "assistant", { type: "step-finish" }),
		]);

		expect(patches).toEqual([
			{ type: "append", payload: { kind: "thinking", text: "Pensando o caminho" } },
		]);
	});

	test("ferramenta nasce em execução e fecha com o desfecho uma única vez", () => {
		const translator = createOpencodeTranscriptTranslator();
		const running = [
			row("t1", "assistant", {
				type: "tool",
				tool: "bash",
				callID: "call_1",
				state: { status: "running", input: { command: "bun test" } },
			}),
		];
		const completed = [
			row("t1", "assistant", {
				type: "tool",
				tool: "bash",
				callID: "call_1",
				state: { status: "completed", input: { command: "bun test" }, output: "ok" },
			}),
		];

		expect(translator.translate(running)).toEqual([
			{
				type: "append",
				payload: {
					kind: "tool_use",
					toolUseId: "call_1",
					name: "bash",
					label: "Terminal",
					status: "running",
					detail: "bun test",
				},
			},
		]);

		expect(translator.translate(completed)).toEqual([
			{ type: "settle", toolUseId: "call_1", ok: true },
		]);
		expect(translator.translate(completed)).toEqual([]);
	});

	test("parte sintética e tipos estruturais não viram fala", () => {
		const translator = createOpencodeTranscriptTranslator();

		const patches = translator.translate([
			row("x1", "user", { type: "text", text: "contexto injetado", synthetic: true }),
			row("x2", "assistant", { type: "step-start" }),
			row("x3", "assistant", { type: "patch", hash: "abc", files: ["/repo/a.ts"] }),
		]);

		expect(patches).toEqual([]);
	});

	test("o modelo observado nas mensagens sai no getter", () => {
		const translator = createOpencodeTranscriptTranslator();

		expect(translator.model()).toBeNull();
		translator.observeModel("gpt-5.6-sol");
		translator.observeModel("");
		expect(translator.model()).toBe("gpt-5.6-sol");
	});
});
