import { expect, test } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readSessionHead } from "./head";
import { claudeDirPrefix, type CliSessionFile } from "./paths";

const SESSION_ID = "11111111-2222-4333-8444-555555555555";

async function withSession(
	cli: CliSessionFile["cli"],
	lines: unknown[],
	run: (file: CliSessionFile) => Promise<void>,
) {
	const dir = await mkdtemp(join(tmpdir(), "kowork-history-"));
	const path = join(dir, `${SESSION_ID}.jsonl`);
	await Bun.write(path, lines.map((line) => `${JSON.stringify(line)}\n`).join(""));
	const stats = await stat(path);

	try {
		await run({
			cli,
			sessionId: SESSION_ID,
			path,
			updatedAt: stats.mtimeMs,
			sizeBytes: stats.size,
		});
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

test("a pasta do claude é o caminho com todo símbolo virando traço", () => {
	expect(claudeDirPrefix("/mnt/data/Projects/koworker")).toBe("-mnt-data-Projects-koworker");
	expect(claudeDirPrefix("/home/pedro/.kw-workflow")).toBe("-home-pedro--kw-workflow");
});

test("o título do claude pula comando seco e sai da primeira fala com assunto", async () => {
	await withSession(
		"claude",
		[
			{ type: "user", message: { role: "user", content: "/clear" }, cwd: "/tmp/projeto" },
			{
				type: "user",
				message: { role: "user", content: "<command-name>/commit</command-name>" },
			},
			{
				type: "user",
				message: { role: "user", content: "Refatore o carregamento da lista" },
				gitBranch: "main",
				timestamp: "2026-08-01T10:00:00.000Z",
			},
		],
		async (file) => {
			const head = await readSessionHead(file);

			expect(head.title).toBe("Refatore o carregamento da lista");
			expect(head.cwd).toBe("/tmp/projeto");
			expect(head.gitBranch).toBe("main");
			expect(head.root).toBe(true);
		},
	);
});

test("o cabeçalho do codex vem do session_meta e recusa rollout derivado", async () => {
	await withSession(
		"codex",
		[
			{
				type: "session_meta",
				payload: {
					id: "outro-id",
					cwd: "/tmp/projeto",
					timestamp: "2026-08-01T10:00:00.000Z",
					source: "cli",
					git: { branch: "dev" },
				},
			},
			{ type: "event_msg", payload: { type: "user_message", message: "suba o servidor" } },
		],
		async (file) => {
			const head = await readSessionHead(file);

			expect(head.root).toBe(false);
			expect(head.cwd).toBe("/tmp/projeto");
			expect(head.gitBranch).toBe("dev");
			expect(head.title).toBe("suba o servidor");
		},
	);
});
