import { expect, test } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readSessionDigest, readSessionEvents } from "./digest";
import type { CliSessionFile } from "./paths";

const SESSION_ID = "99999999-8888-4777-8666-555555555555";
const WORKED = ".koworker/tasks/terminais--ab12cd34/historico-de-conversas--ef56ab78";
const MENTIONED_ONCE = ".koworker/tasks/outra--11112222/passou-de-raspao--33334444";

async function withSession(lines: unknown[], run: (file: CliSessionFile) => Promise<void>) {
	const dir = await mkdtemp(join(tmpdir(), "kowork-digest-"));
	const path = join(dir, `${SESSION_ID}.jsonl`);
	await Bun.write(path, lines.map((line) => `${JSON.stringify(line)}\n`).join(""));
	const stats = await stat(path);

	try {
		await run({
			cli: "claude",
			sessionId: SESSION_ID,
			path,
			updatedAt: stats.mtimeMs,
			sizeBytes: stats.size,
		});
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

test("a pasta trabalhada é contada mais vezes que a citada de passagem", async () => {
	await withSession(
		[
			{ type: "user", message: { role: "user", content: `Leia ${WORKED}/index.md` } },
			{
				type: "assistant",
				message: { content: [{ type: "text", text: `Escrevi em ${WORKED}/plano.md` }] },
			},
			{
				type: "assistant",
				message: { content: [{ type: "text", text: `Existe também ${MENTIONED_ONCE}` }] },
			},
			{
				type: "assistant",
				message: { content: [{ type: "text", text: `Concluí ${WORKED}` }] },
			},
		],
		async (file) => {
			const digest = await readSessionDigest(file);

			expect(digest.taskFolderPaths[0]).toEqual({ path: WORKED, count: 3 });
			expect(digest.taskFolderPaths.find((entry) => entry.path === MENTIONED_ONCE)?.count).toBe(1);
			expect(digest.preview).toContain("Concluí");
		},
	);
});

test("a conversa inteira sai em blocos numerados na ordem do arquivo", async () => {
	await withSession(
		[
			{ type: "user", message: { role: "user", content: "suba o servidor" } },
			{ type: "assistant", message: { content: [{ type: "text", text: "subindo" }] } },
		],
		async (file) => {
			const events = await readSessionEvents(file);

			expect(events.map((event) => event.payload.kind)).toEqual(["user", "assistant"]);
			expect(events.map((event) => event.seq)).toEqual([0, 1]);
		},
	);
});
