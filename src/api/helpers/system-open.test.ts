import { expect, test } from "bun:test";
import { runSystemOpen } from "./system-open";

test("servidor atende enquanto o aplicativo aberto continua vivo", async () => {
	const server = Bun.serve({ port: 0, fetch: () => Response.json({ ok: true }) });
	const started = performance.now();
	const opening = runSystemOpen(
		[[process.execPath, "-e", "setTimeout(() => {}, 2500)"]],
		process.env,
	);

	try {
		const response = await fetch(`http://127.0.0.1:${server.port}/healthz`, {
			signal: AbortSignal.timeout(1000),
		});
		expect(await response.json()).toEqual({ ok: true });
		await opening;
		expect(performance.now() - started).toBeLessThan(1500);
	} finally {
		server.stop(true);
	}
});

test("tenta o próximo aplicativo quando o primeiro falha ao iniciar", async () => {
	await expect(
		runSystemOpen(
			[
				[process.execPath, "-e", "process.exit(1)"],
				[process.execPath, "-e", "process.exit(0)"],
			],
			process.env,
		),
	).resolves.toBeUndefined();
});

test("comando ausente permite tentar o próximo aplicativo", async () => {
	await expect(
		runSystemOpen(
			[["/aplicativo-que-nao-existe-kowork"], [process.execPath, "-e", "process.exit(0)"]],
			process.env,
		),
	).resolves.toBeUndefined();
});

test("informa falha quando nenhum aplicativo inicia", async () => {
	await expect(
		runSystemOpen([[process.execPath, "-e", "process.exit(7)"]], process.env),
	).rejects.toThrow("saiu com código 7");
});
