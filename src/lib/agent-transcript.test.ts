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
