import { expect, test } from "bun:test";

import { spawnCapture } from "./spawn";

test("cancela o subprocesso headless por sinal", async () => {
	const controller = new AbortController();
	const resultPromise = spawnCapture({
		cmd: ["sh", "-c", "sleep 10 & echo $!; wait"],
		cwd: "/tmp",
		timeoutMs: 30_000,
		signal: controller.signal,
	});

	await Bun.sleep(50);
	controller.abort();
	const result = await resultPromise;
	const childPid = Number(result.stdout.trim());
	await Bun.sleep(100);
	let childAlive = true;
	try {
		process.kill(childPid, 0);
	} catch {
		childAlive = false;
	}

	expect(result.cancelled).toBe(true);
	expect(result.timedOut).toBe(false);
	expect(childAlive).toBe(false);
});

test("não pendura quando um neto herda o pipe de saída", async () => {
	const result = await spawnCapture({
		cmd: ["sh", "-c", "sleep 30 & echo pronto"],
		cwd: "/tmp",
		timeoutMs: 60_000,
	});

	expect(result.stdout.trim()).toBe("pronto");
	expect(result.exitCode).toBe(0);
	expect(result.timedOut).toBe(false);
}, 20_000);

test("captura o stderr do processo", async () => {
	const result = await spawnCapture({
		cmd: ["sh", "-c", "echo falhou 1>&2; exit 3"],
		cwd: "/tmp",
		timeoutMs: 10_000,
	});

	expect(result.stderr.trim()).toBe("falhou");
	expect(result.exitCode).toBe(3);
});
