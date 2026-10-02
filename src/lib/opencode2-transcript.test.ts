import { describe, expect, test } from "bun:test";

import {
	createOpencode2TranscriptTranslator,
	type Opencode2MessageRow,
} from "./opencode2-transcript";

function user(text: string, id = "msg_user"): Opencode2MessageRow {
	return { id, type: "user", data: { text, time: { created: 1 } } };
}

function assistant(
	content: Record<string, unknown>[],
	options: { completed?: boolean; id?: string; model?: string } = {},
): Opencode2MessageRow {
	return {
		id: options.id ?? "msg_assistant",
		type: "assistant",
		data: {
			time: { created: 1, ...(options.completed ? { completed: 2 } : {}) },
			...(options.model ? { model: { id: options.model } } : {}),
			content,
		},
	};
}

describe("createOpencode2TranscriptTranslator", () => {
	test("fala do usuário vira bloco uma vez só, mesmo em consulta repetida", () => {
		const translator = createOpencode2TranscriptTranslator();
		const rows = [user("Ajuste o parallax")];

		expect(translator.translate(rows)).toEqual([
			{ type: "append", payload: { kind: "user", text: "Ajuste o parallax" } },
		]);
		expect(translator.translate(rows)).toEqual([]);
	});

	test("texto e raciocínio esperam a mensagem fechar", () => {
		const translator = createOpencode2TranscriptTranslator();
		const content = [
			{ type: "reasoning", text: "Preciso ler o arquivo" },
			{ type: "text", text: "Pronto" },
		];

		expect(translator.translate([assistant(content)])).toEqual([]);
		expect(translator.translate([assistant(content, { completed: true })])).toEqual([
			{ type: "append", payload: { kind: "thinking", text: "Preciso ler o arquivo" } },
			{ type: "append", payload: { kind: "assistant", text: "Pronto" } },
		]);
	});

	test("ferramenta aparece enquanto roda e é resolvida quando termina", () => {
		const translator = createOpencode2TranscriptTranslator();
		const running = [
			{
				type: "tool",
				id: "call_1",
				name: "bash",
				state: { status: "running", input: { command: "bun test" } },
			},
		];

		expect(translator.translate([assistant(running)])).toEqual([
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

		const done = [
			{ ...running[0], state: { status: "completed", input: { command: "bun test" } } },
		];
		expect(translator.translate([assistant(done)])).toEqual([
			{ type: "settle", toolUseId: "call_1", ok: true },
		]);
		expect(translator.translate([assistant(done)])).toEqual([]);
	});

	test("ferramenta que falhou leva a mensagem do erro", () => {
		const translator = createOpencode2TranscriptTranslator();
		const rows = [
			assistant([
				{
					type: "tool",
					id: "call_2",
					name: "read",
					state: {
						status: "error",
						input: { filePath: "/tmp/nada" },
						error: { message: "File not found: /tmp/nada" },
					},
				},
			]),
		];

		expect(translator.translate(rows)).toEqual([
			{
				type: "append",
				payload: {
					kind: "tool_use",
					toolUseId: "call_2",
					name: "read",
					label: "Ler arquivo",
					status: "running",
					detail: "/tmp/nada",
				},
			},
			{ type: "settle", toolUseId: "call_2", ok: false, detail: "File not found: /tmp/nada" },
		]);
	});

	test("o modelo da conversa vem da última mensagem do agente", () => {
		const translator = createOpencode2TranscriptTranslator();
		expect(translator.model()).toBeNull();

		translator.translate([assistant([], { completed: true, model: "muse-spark-1.3" })]);
		expect(translator.model()).toBe("muse-spark-1.3");
	});

	test("parte injetada pelo próprio opencode não vira fala", () => {
		const translator = createOpencode2TranscriptTranslator();
		const rows = [
			assistant([{ type: "text", text: "contexto do projeto", synthetic: true }], {
				completed: true,
			}),
		];

		expect(translator.translate(rows)).toEqual([]);
	});
});
