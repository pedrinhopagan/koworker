import { describe, expect, test } from "bun:test";

import { createTranscriptMirror, createTranscriptParser } from "./agent-transcript";
import { translateClaudeTranscriptLine } from "./claude-transcript";

describe("createTranscriptParser", () => {
	test("a linha partida entre duas leituras espera a continuação", () => {
		const parser = createTranscriptParser(translateClaudeTranscriptLine);
		const line = JSON.stringify({ type: "user", message: { role: "user", content: "oi" } });

		expect(parser.push(line.slice(0, 20))).toEqual([]);
		expect(parser.push(`${line.slice(20)}\n`)).toEqual([
			{ type: "append", payload: { kind: "user", text: "oi" } },
		]);
	});
});

describe("createTranscriptMirror", () => {
	test("o resultado da ferramenta fecha o bloco que já está na conversa", () => {
		const mirror = createTranscriptMirror("w5E:p3", 10);

		mirror.apply([
			{
				type: "append",
				payload: {
					kind: "tool_use",
					toolUseId: "toolu_1",
					name: "Read",
					label: "Ler arquivo",
					status: "running",
				},
			},
		]);
		const changed = mirror.apply([{ type: "settle", toolUseId: "toolu_1", ok: true }]);

		expect(mirror.list()).toHaveLength(1);
		expect(changed[0]?.seq).toBe(0);
		expect(mirror.list()[0]?.payload).toMatchObject({ kind: "tool_use", status: "ok" });
	});

	test("a resposta fecha o bloco de pergunta com o que o usuário escolheu", () => {
		const mirror = createTranscriptMirror("w5E:p3");

		mirror.apply([
			{
				type: "append",
				payload: {
					kind: "question",
					questionId: "toolu_q#0",
					question: "Qual direção seguir?",
					options: [{ label: "Neutro" }, { label: "Radical" }],
					multiSelect: false,
				},
			},
			{
				type: "append",
				payload: {
					kind: "question",
					questionId: "toolu_q#1",
					question: "Aplicar agora?",
					options: [{ label: "Sim" }, { label: "Não" }],
					multiSelect: false,
				},
			},
		]);

		const changed = mirror.apply([
			{
				type: "answer",
				toolUseId: "toolu_q",
				text: '"Qual direção seguir?"="Neutro", "Aplicar agora?"="Sim, mas só o item 1".',
			},
		]);

		expect(changed).toHaveLength(2);
		expect(mirror.list()[0]?.payload).toMatchObject({ kind: "question", answers: ["Neutro"] });
		expect(mirror.list()[1]?.payload).toMatchObject({
			kind: "question",
			answers: ["Sim, mas só o item 1"],
		});
	});

	test("resposta sem pergunta correspondente não muda a conversa", () => {
		const mirror = createTranscriptMirror("w5E:p3");

		expect(mirror.apply([{ type: "answer", toolUseId: "toolu_x", text: '"Q"="A".' }])).toEqual([]);
		expect(mirror.list()).toHaveLength(0);
	});

	test("resultado sem ferramenta correspondente não inventa bloco", () => {
		const mirror = createTranscriptMirror("w5E:p3", 10);

		expect(mirror.apply([{ type: "settle", toolUseId: "sumiu", ok: false }])).toEqual([]);
		expect(mirror.list()).toEqual([]);
	});

	test("a conversa guarda só a cauda que cabe na tela", () => {
		const mirror = createTranscriptMirror("w5E:p3", 2);

		for (const text of ["um", "dois", "três"]) {
			mirror.apply([{ type: "append", payload: { kind: "assistant", text } }]);
		}

		expect(mirror.list().map((event) => event.payload)).toEqual([
			{ kind: "assistant", text: "dois" },
			{ kind: "assistant", text: "três" },
		]);
	});

	test("arquivo trocado recomeça a conversa do zero", () => {
		const mirror = createTranscriptMirror("w5E:p3", 10);

		mirror.apply([{ type: "append", payload: { kind: "assistant", text: "sessão antiga" } }]);
		mirror.reset();
		const events = mirror.apply([
			{ type: "append", payload: { kind: "user", text: "sessão nova" } },
		]);

		expect(mirror.list()).toHaveLength(1);
		expect(events[0]?.seq).toBe(0);
	});
});
