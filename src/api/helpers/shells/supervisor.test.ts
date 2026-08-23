import { afterAll, expect, test } from "bun:test";

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ShellSupervisor } from "./supervisor";

const supervisor = new ShellSupervisor();
const spawned: string[] = [];

afterAll(() => {
	for (const id of spawned) {
		supervisor.close(id);
	}
});

async function waitFor(condition: () => boolean, timeoutMs = 5_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (condition()) {
			return;
		}

		await Bun.sleep(50);
	}

	throw new Error("condição não aconteceu a tempo");
}

function decodeBase64(b64: string): string {
	return Buffer.from(b64, "base64").toString("utf8");
}

async function openShell() {
	const cwd = await mkdtemp(join(tmpdir(), "kw-shell-"));
	// --norc isola o teste do PROMPT_COMMAND do usuário, que disputa o título da aba.
	const shell = supervisor.open({
		cwd,
		cols: 80,
		rows: 24,
		shellPath: "bash",
		shellArgs: ["--norc", "--noprofile"],
	});
	spawned.push(shell.id);
	return shell;
}

test("shell abre vivo e executa comando no cwd escolhido", async () => {
	const shell = await openShell();
	supervisor.write(shell.id, "echo kw-marker-$((6*7))\rexit\r");

	await waitFor(() => supervisor.get(shell.id)?.status === "exited");

	const replay = decodeBase64(supervisor.replayBase64(shell.id) ?? "");
	expect(supervisor.get(shell.id)?.status).toBe("exited");
	expect(replay).toContain("kw-marker-42");
});

test("scrollback sobrevive ao reattach: replay traz o que foi escrito antes do attach", async () => {
	const shell = await openShell();
	supervisor.write(shell.id, "echo replay-check-$((3*7))\r");

	await waitFor(() =>
		decodeBase64(supervisor.replayBase64(shell.id) ?? "").includes("replay-check-21"),
	);

	expect(decodeBase64(supervisor.replayBase64(shell.id) ?? "")).toContain("replay-check-21");
});

test("ring buffer guarda a cauda quando a saída passa de 1 MB", async () => {
	const shell = await openShell();

	for (let index = 0; index < 12; index++) {
		supervisor.write(shell.id, `echo bloco-${index}-${"x".repeat(100_000)}\r`);
	}

	await waitFor(
		() => decodeBase64(supervisor.replayBase64(shell.id) ?? "").includes("bloco-11-"),
		10_000,
	);

	const replay = decodeBase64(supervisor.replayBase64(shell.id) ?? "");
	expect(replay.length).toBeLessThan(1_100_000);
	expect(replay).toContain("bloco-11-");
	expect(replay).not.toContain("bloco-0-");
});

test("título publicado pelo CLI via OSC chega no registro", async () => {
	const shell = await openShell();

	supervisor.write(shell.id, "printf '\\033]0;titulo-do-cli\\007'\r");

	await waitFor(() => supervisor.get(shell.id)?.title === "titulo-do-cli");

	expect(supervisor.get(shell.id)?.title).toBe("titulo-do-cli");
});

test("rename muda o rótulo e resize valida limites", async () => {
	const shell = await openShell();

	const renamed = supervisor.rename(shell.id, "build");
	expect(renamed?.label).toBe("build");

	expect(supervisor.resize(shell.id, 120, 40)).toBe(true);
	expect(supervisor.resize(shell.id, 1, 24)).toBe(false);
	expect(supervisor.resize(shell.id, 9999, 24)).toBe(false);
});
