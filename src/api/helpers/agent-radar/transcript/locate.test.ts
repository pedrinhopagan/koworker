import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { claudeProjectSlug, locateAgentTranscript } from "./locate";

test("o caminho reportado pelo próprio agent dispensa a busca no disco", async () => {
	const root = await mkdtemp(join(tmpdir(), "kowork-transcript-locate-"));
	const path = join(root, "sessao.jsonl");
	await Bun.write(path, "sessão");

	try {
		expect(
			await locateAgentTranscript({
				agent: "claude",
				cwd: "/repo",
				sessionId: null,
				sessionPath: path,
			}),
		).toEqual({ cli: "claude", path });
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("dois agents no mesmo diretório recebem somente o próprio rollout", async () => {
	const root = await mkdtemp(join(tmpdir(), "kowork-transcript-locate-"));
	const codexSessionsDir = join(root, "codex");
	const claudeProjectsDir = join(root, "claude");
	const firstId = "019ff5b8-f64b-70c2-a7db-01b580333fdf";
	const secondId = "019ff5b8-1686-74c3-90c4-dca922610a5a";
	const day = join(codexSessionsDir, "2026", "08", "12");
	await mkdir(day, { recursive: true });
	const firstPath = join(day, `rollout-2026-08-12T08-26-07-${firstId}.jsonl`);
	const secondPath = join(day, `rollout-2026-08-12T08-25-10-${secondId}.jsonl`);
	await Bun.write(firstPath, "primeiro");
	await Bun.write(secondPath, "segundo");

	try {
		expect(
			await locateAgentTranscript(
				{ agent: "codex", cwd: "/repo", sessionId: firstId, sessionPath: null },
				{ claudeProjectsDir, codexSessionsDir, opencodeDbPath: join(root, "opencode.db") },
			),
		).toEqual({ cli: "codex", path: firstPath });
		expect(
			await locateAgentTranscript(
				{ agent: "codex", cwd: "/repo", sessionId: secondId, sessionPath: null },
				{ claudeProjectsDir, codexSessionsDir, opencodeDbPath: join(root, "opencode.db") },
			),
		).toEqual({ cli: "codex", path: secondPath });
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("a sessão do claude é resolvida pelo id dentro do projeto correto", async () => {
	const root = await mkdtemp(join(tmpdir(), "kowork-transcript-locate-"));
	const claudeProjectsDir = join(root, "claude");
	const cwd = "/repo/pacote";
	const sessionId = "644689fd-88cf-410e-a5c7-137498d1464b";
	const path = join(claudeProjectsDir, claudeProjectSlug(cwd), `${sessionId}.jsonl`);
	await mkdir(join(claudeProjectsDir, claudeProjectSlug(cwd)), { recursive: true });
	await Bun.write(path, "claude");

	try {
		expect(
			await locateAgentTranscript(
				{ agent: "claude", cwd, sessionId, sessionPath: null },
				{
					claudeProjectsDir,
					codexSessionsDir: join(root, "codex"),
					opencodeDbPath: join(root, "opencode.db"),
				},
			),
		).toEqual({ cli: "claude", path });
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("sessão identificada ainda sem arquivo não cai em transcript antigo do cwd", async () => {
	const root = await mkdtemp(join(tmpdir(), "kowork-transcript-locate-"));

	try {
		expect(
			await locateAgentTranscript(
				{
					agent: "codex",
					cwd: "/repo",
					sessionId: "019ff5b8-f64b-70c2-a7db-01b580333fdf",
					sessionPath: null,
				},
				{
					claudeProjectsDir: join(root, "claude"),
					codexSessionsDir: join(root, "codex"),
					opencodeDbPath: join(root, "opencode.db"),
				},
			),
		).toBeNull();
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("agent que não grava transcript não tem conversa para abrir", async () => {
	expect(
		await locateAgentTranscript({
			agent: "nvim",
			cwd: "/repo",
			sessionId: null,
			sessionPath: "/tmp/sessao.jsonl",
		}),
	).toBeNull();
});
