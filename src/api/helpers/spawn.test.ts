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
