import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ShellSendSchema } from "@/api/schemas/shells";

import { resolveShellTranscript, sendShellPrompt } from "./conversation";
import { shellRuntime } from "./supervisor";

process.env.NODE_ENV = "development";
const { subscribeAgentRadarTranscript, openPaneTranscriptEvents } =
	await import("../agent-radar/transcript");

const roots: string[] = [];
const shells: string[] = [];

afterEach(async () => {
	for (const id of shells.splice(0)) {
		shellRuntime.execute({ type: "close", id });
	}
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function waitFor(check: () => boolean | Promise<boolean>) {
	for (let attempt = 0; attempt < 100; attempt += 1) {
		if (await check()) {
			return;
		}
		await Bun.sleep(30);
	}
	throw new Error("O processo de teste não ficou pronto");
}

async function openAgent() {
	const root = await mkdtemp(join(tmpdir(), "kowork-shell-chat-"));
	roots.push(root);
	const sessionId = "93156c4a-eefc-4d5c-8476-ebc230c92bef";
	const directory = join(root, ".claude/projects/test");
	await mkdir(directory, { recursive: true });
	const path = join(directory, `${sessionId}.jsonl`);
	const received = join(root, "received");
	const script = join(root, "claude");
	await writeFile(
		script,
		`
import { openSync, writeSync, appendFileSync } from "node:fs";
const fd = openSync(${JSON.stringify(path)}, "a");
writeSync(fd, JSON.stringify({ type: "user", uuid: "first", message: { role: "user", content: "Olá pelo terminal" } }) + "\\n");
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on("data", (data) => appendFileSync(${JSON.stringify(received)}, data));
process.stdout.write("\\u001B[?2004hready");
`,
	);
	const shell = shellRuntime.execute({
		type: "open",
		cwd: root,
		cols: 80,
		rows: 24,
		shellPath: process.execPath,
		shellArgs: [script],
	});
	shells.push(shell.id);
	await waitFor(() =>
		Buffer.from(shellRuntime.attach(shell.id)?.replayBase64 ?? "", "base64")
			.toString()
			.includes("ready"),
	);
	return { shell, path, received };
}

test("chat lê o histórico do shell e envia texto multilinha ao mesmo PTY", async () => {
	const { shell, path, received } = await openAgent();
	expect((await resolveShellTranscript(shell.id))?.path).toBe(path);
	const controller = new AbortController();
	const stream = subscribeAgentRadarTranscript(shell.id, controller.signal);
	try {
		const first = await stream.next();
		const secondReader = subscribeAgentRadarTranscript(shell.id);
		await secondReader.next();
		await secondReader.return();
		expect(
			first.value?.events?.some(
				(event) =>
					event.payload.kind === "user" && event.payload.text.includes("Olá pelo terminal"),
			),
		).toBe(true);
	} finally {
		controller.abort();
		await stream.return();
	}
	expect(openPaneTranscriptEvents(shell.id)).toBeNull();

	await sendShellPrompt({
		id: shell.id,
		agent: "claude",
		sourcePath: path,
		text: "linha um\nlinha dois",
	});
	await waitFor(async () =>
		(
			await Bun.file(received)
				.text()
				.catch(() => "")
		).endsWith("\r"),
	);
	expect(await Bun.file(received).text()).toBe("linha um\u001B[13;2ulinha dois\r");
}, 10_000);

test("recusa envio para agente ou sessão diferentes sem escrever no terminal", async () => {
	const { shell, received } = await openAgent();
	await expect(sendShellPrompt({ id: shell.id, agent: "codex", text: "oi" })).rejects.toThrow(
		"O agente mudou",
	);
	await expect(
		sendShellPrompt({ id: shell.id, agent: "claude", text: "oi", sourcePath: "/outra-sessao" }),
	).rejects.toThrow("A sessão mudou");
	expect(await Bun.file(received).exists()).toBe(false);
	shellRuntime.execute({ type: "close", id: shell.id });
	await expect(sendShellPrompt({ id: shell.id, agent: "claude", text: "oi" })).rejects.toThrow(
		"O agente mudou",
	);
});

test("mensagem rejeita sequências de controle que escapam do paste", () => {
	expect(
		ShellSendSchema.safeParse({ id: "shell-test", agent: "codex", text: "oi\u001B[201~" }).success,
	).toBe(false);
	expect(
		ShellSendSchema.safeParse({ id: "shell-test", agent: "codex", text: "oi\n\ttexto" }).success,
	).toBe(true);
});
