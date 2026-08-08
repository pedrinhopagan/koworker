import { expect, test } from "bun:test";

import { locateAgentTranscript } from "./locate";

test("o caminho reportado pelo próprio agent dispensa a busca no disco", async () => {
	expect(
		await locateAgentTranscript({
			agent: "claude",
			sessionPath: "/tmp/sessao.jsonl",
		}),
	).toEqual({ cli: "claude", path: "/tmp/sessao.jsonl" });
});

test("agent que não grava transcript não tem conversa para abrir", async () => {
	expect(
		await locateAgentTranscript({ agent: "nvim", sessionPath: "/tmp/sessao.jsonl" }),
	).toBeNull();
});

test("agent sem caminho reportado nunca recebe transcript por aproximação", async () => {
	expect(await locateAgentTranscript({ agent: "claude", sessionPath: null })).toBeNull();
	expect(await locateAgentTranscript({ agent: "codex", sessionPath: "  " })).toBeNull();
});

test("dois agents no mesmo diretório dependem dos próprios caminhos reportados", async () => {
	const first = await locateAgentTranscript({ agent: "codex", sessionPath: "/tmp/primeiro.jsonl" });
	const second = await locateAgentTranscript({ agent: "codex", sessionPath: "/tmp/segundo.jsonl" });

	expect(first?.path).not.toBe(second?.path);
});
