import { expect, test } from "bun:test";

import { claudeProjectSlug, locateAgentTranscript } from "./locate";

test("a pasta da sessão do claude é o cwd com todo separador virando hífen", () => {
	expect(claudeProjectSlug("/mnt/data/Projects/koworker")).toBe("-mnt-data-Projects-koworker");
	expect(claudeProjectSlug("/home/pedro/.kw-workflow")).toBe("-home-pedro--kw-workflow");
});

test("o caminho reportado pelo próprio agent dispensa a busca no disco", async () => {
	expect(
		await locateAgentTranscript({
			agent: "claude",
			cwd: "/repo",
			sessionPath: "/tmp/sessao.jsonl",
		}),
	).toEqual({ cli: "claude", path: "/tmp/sessao.jsonl" });
});

test("agent que não grava transcript não tem conversa para abrir", async () => {
	expect(
		await locateAgentTranscript({ agent: "nvim", cwd: "/repo", sessionPath: "/tmp/sessao.jsonl" }),
	).toBeNull();
});
