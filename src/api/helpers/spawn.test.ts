import { expect, test } from "bun:test";

import {
	collectStream,
	displayFallback,
	spawnCapture,
	spawnEnv,
	STREAM_TAIL_MAX_BYTES,
} from "./spawn";

function streamOf(chunks: Uint8Array[]) {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(chunk);
			}
			controller.close();
		},
	});
}

test("mantém apenas a cauda quando a saída passa do teto de memória", async () => {
	const chunk = new Uint8Array(512 * 1024).fill(65);
	const chunks = Array.from({ length: 200 }, () => chunk);
	const collected = collectStream(streamOf(chunks));

	await collected.drained;
	const text = collected.text();

	expect(chunks.length * chunk.byteLength).toBeGreaterThan(STREAM_TAIL_MAX_BYTES * 10);
	expect(text.length).toBeLessThanOrEqual(STREAM_TAIL_MAX_BYTES + 64);
	expect(text).toContain("(início truncado)");
});

test("preserva o fim da saída, que é onde o resultado do agente vive", async () => {
	const encoder = new TextEncoder();
	const filler = new Uint8Array(STREAM_TAIL_MAX_BYTES).fill(65);
	const collected = collectStream(streamOf([filler, filler, encoder.encode("resultado final")]));

	await collected.drained;

	expect(collected.text().endsWith("resultado final")).toBe(true);
});

test("entrega os pedaços ao consumidor ao vivo, sem esperar o fim", async () => {
	const encoder = new TextEncoder();
	const received: string[] = [];
	const collected = collectStream(
		streamOf([encoder.encode("primeiro\n"), encoder.encode("segundo\n")]),
		(text) => received.push(text),
	);

	await collected.drained;

	expect(received).toEqual(["primeiro\n", "segundo\n"]);
});

test("captura a saída inteira quando ela cabe no teto", async () => {
	const collected = collectStream(streamOf([new TextEncoder().encode("saída curta")]));

	await collected.drained;

	expect(collected.text()).toBe("saída curta");
});

test("prioriza binários do usuário sobre versões antigas em /usr/bin", () => {
	const path = process.env.PATH;
	const home = process.env.HOME;
	process.env.HOME = "/home/pedro";
	process.env.PATH = "/usr/local/bin:/usr/bin:/home/pedro/.bun/bin";

	try {
		const env = spawnEnv();

		expect(env.PATH?.split(":").slice(0, 2)).toEqual([
			"/home/pedro/.local/bin",
			"/home/pedro/.bun/bin",
		]);
		expect(env.PATH).toContain("/usr/bin");
	} finally {
		process.env.PATH = path;
		process.env.HOME = home;
	}
});

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

test("reconstrói o display quando o backend nasceu sem env gráfico", async () => {
	if (process.platform !== "linux") {
		return;
	}

	const runtimeDir = `${process.env.TMPDIR ?? "/tmp"}/spawn-display-${Date.now()}`;
	await Bun.write(`${runtimeDir}/wayland-7`, "");

	const found = displayFallback({ XDG_RUNTIME_DIR: runtimeDir });
	expect(found.WAYLAND_DISPLAY).toBe("wayland-7");

	const untouched = displayFallback({ WAYLAND_DISPLAY: "wayland-0" });
	expect(untouched).toEqual({});
});
