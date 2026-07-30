import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AgentSessionEvent } from "@/lib/agent-session";
import { openTranscriptTail } from "./tail";

const USER_LINE = `${JSON.stringify({ type: "user", message: { role: "user", content: "suba o servidor" } })}\n`;
const ASSISTANT_LINE = `${JSON.stringify({
	type: "assistant",
	message: { content: [{ type: "text", text: "subindo" }] },
})}\n`;

async function withTail(
	run: (input: {
		path: string;
		batches: { events: AgentSessionEvent[]; reset: boolean }[];
		waitFor: (count: number) => Promise<void>;
	}) => Promise<void>,
) {
	const dir = await mkdtemp(join(tmpdir(), "kowork-transcript-"));
	const path = join(dir, "sessao.jsonl");
	await Bun.write(path, USER_LINE);

	const batches: { events: AgentSessionEvent[]; reset: boolean }[] = [];
	const tail = await openTranscriptTail({
		sessionId: "w5E:p3",
		source: { cli: "claude", path },
		onEvents: (events, reset) => batches.push({ events, reset }),
		onError: (error) => expect.unreachable(String(error)),
	});

	async function waitFor(count: number) {
		for (let attempt = 0; attempt < 50 && batches.length < count; attempt += 1) {
			await Bun.sleep(20);
		}
	}

	try {
		await run({ path, batches, waitFor });
	} finally {
		tail.close();
		await rm(dir, { recursive: true, force: true });
	}
}

test("a abertura entrega a conversa que já está no arquivo", async () => {
	await withTail(({ batches }) => {
		expect(batches).toHaveLength(1);
		expect(batches[0]?.reset).toBe(true);
		expect(batches[0]?.events.map((event) => event.payload)).toEqual([
			{ kind: "user", text: "suba o servidor" },
		]);

		return Promise.resolve();
	});
});

test("o que o CLI acrescenta chega sozinho, sem reenviar a conversa", async () => {
	await withTail(async ({ path, batches, waitFor }) => {
		await Bun.write(path, `${USER_LINE}${ASSISTANT_LINE}`);
		await waitFor(2);

		expect(batches).toHaveLength(2);
		expect(batches[1]?.reset).toBe(false);
		expect(batches[1]?.events.map((event) => event.payload)).toEqual([
			{ kind: "assistant", text: "subindo" },
		]);
		expect(batches[1]?.events[0]?.seq).toBe(1);
	});
});

test("arquivo trocado por uma sessão nova recomeça a conversa", async () => {
	await withTail(async ({ path, batches, waitFor }) => {
		await Bun.write(
			path,
			`${JSON.stringify({ type: "user", message: { role: "user", content: "nova" } })}\n`,
		);
		await waitFor(2);

		expect(batches[1]?.reset).toBe(true);
		expect(batches[1]?.events.map((event) => event.payload)).toEqual([
			{ kind: "user", text: "nova" },
		]);
		expect(batches[1]?.events[0]?.seq).toBe(0);
	});
});
