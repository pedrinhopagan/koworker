import { afterAll, describe, expect, test } from "bun:test";

import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ShellRuntime, shellAgentStatus } from "./supervisor";

const runtime = new ShellRuntime();
const spawned: string[] = [];

afterAll(() => {
	for (const id of spawned) {
		runtime.execute({ type: "close", id });
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
	const shell = runtime.execute({
		type: "open",
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
	runtime.execute({ type: "input", id: shell.id, data: "echo kw-marker-$((6*7))\rexit\r" });

	await waitFor(() => runtime.snapshot(shell.id)?.status === "exited");

	const replay = decodeBase64(runtime.attach(shell.id)?.replayBase64 ?? "");
	expect(runtime.snapshot(shell.id)?.status).toBe("exited");
	expect(replay).toContain("kw-marker-42");
});

test("scrollback sobrevive ao reattach: replay traz o que foi escrito antes do attach", async () => {
	const shell = await openShell();
	runtime.execute({ type: "input", id: shell.id, data: "echo replay-check-$((3*7))\r" });

	await waitFor(() =>
		decodeBase64(runtime.attach(shell.id)?.replayBase64 ?? "").includes("replay-check-21"),
	);

	expect(decodeBase64(runtime.attach(shell.id)?.replayBase64 ?? "")).toContain("replay-check-21");
});

test("ring buffer guarda a cauda quando a saída passa de 1 MB", async () => {
	const shell = await openShell();

	for (let index = 0; index < 12; index++) {
		runtime.execute({
			type: "input",
			id: shell.id,
			data: `echo bloco-${index}-${"x".repeat(100_000)}\r`,
		});
	}

	await waitFor(
		() => decodeBase64(runtime.attach(shell.id)?.replayBase64 ?? "").includes("bloco-11-"),
		10_000,
	);

	const replay = decodeBase64(runtime.attach(shell.id)?.replayBase64 ?? "");
	expect(replay.length).toBeLessThan(1_100_000);
	expect(replay).toContain("bloco-11-");
	expect(replay).not.toContain("bloco-0-");
});

test("título publicado pelo CLI via OSC chega no registro", async () => {
	const shell = await openShell();

	runtime.execute({
		type: "input",
		id: shell.id,
		data: "printf '\\033]0;titulo-do-cli\\007'\r",
	});

	await waitFor(() => runtime.snapshot(shell.id)?.title === "titulo-do-cli");

	expect(runtime.snapshot(shell.id)?.title).toBe("titulo-do-cli");
});

test("rename muda o rótulo e resize valida limites", async () => {
	const shell = await openShell();

	const renamed = runtime.execute({ type: "rename", id: shell.id, label: "build" });
	expect(renamed?.label).toBe("build");

	expect(runtime.execute({ type: "resize", id: shell.id, cols: 120, rows: 40 })).toBe(true);
	expect(runtime.execute({ type: "resize", id: shell.id, cols: 1, rows: 24 })).toBe(false);
	expect(runtime.execute({ type: "resize", id: shell.id, cols: 9999, rows: 24 })).toBe(false);
});

describe("status do agent", () => {
	test("saída recente é working, tela quieta é idle", () => {
		expect(shellAgentStatus({ agentActiveAt: 1_000, now: 2_000 })).toBe("working");
		expect(shellAgentStatus({ agentActiveAt: 1_000, now: 61_000 })).toBe("idle");
	});
});

test("CLI de agent rodando no shell é detectada e vira identidade do item", async () => {
	const fast = new ShellRuntime({ agentSweepMs: 150 });
	const cwd = await mkdtemp(join(tmpdir(), "kw-agent-"));
	const agentBin = join(cwd, "opencode");
	// Falso TUI: nome de agent de verdade e redraw periódico, que é o sinal de "Trabalhando".
	await writeFile(agentBin, "#!/bin/sh\nwhile true; do echo tick; sleep 0.2; done\n");
	await chmod(agentBin, 0o755);

	const shell = fast.execute({
		type: "open",
		cwd,
		cols: 80,
		rows: 24,
		shellPath: "bash",
		shellArgs: ["--norc", "--noprofile"],
	});

	try {
		fast.execute({ type: "input", id: shell.id, data: `exec ${agentBin}\r` });

		await waitFor(() => fast.snapshot(shell.id)?.agent === "opencode", 10_000);
		// Os primeiros ticks caem na janela de eco do comando digitado; o redraw contínuo acende
		// "Trabalhando" no fluxo seguinte.
		await waitFor(() => fast.snapshot(shell.id)?.agentStatus === "working", 5_000);
		expect(fast.snapshot(shell.id)?.agent).toBe("opencode");
	} finally {
		fast.execute({ type: "close", id: shell.id });
	}
}, 20_000);
