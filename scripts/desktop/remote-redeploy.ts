import { appendFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { koworkerDataDir } from "../../src/lib/app-paths";

const REPO_DIR = process.env.KOWORK_REPO_DIR ?? process.cwd();
const dataDir = koworkerDataDir();
const logPath = join(dataDir, "redeploy.log");
const lockPath = join(dataDir, "redeploy.lock");

async function log(message: string) {
	const line = `[${new Date().toISOString()}] ${message}\n`;
	await mkdir(dataDir, { recursive: true });
	await appendFile(logPath, line);
}

async function drainStream(
	stream: ReadableStream<Uint8Array> | null,
	prefix: string,
): Promise<void> {
	if (!stream) {
		return;
	}

	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";

		for (const line of lines) {
			if (line.length) {
				await log(`${prefix}${line}`);
			}
		}
	}

	if (buffer.length) {
		await log(`${prefix}${buffer}`);
	}
}

async function runCommand(label: string, command: string[]) {
	await log(`→ ${label}: ${command.join(" ")}`);

	const proc = Bun.spawn(command, {
		cwd: REPO_DIR,
		env: process.env,
		stdout: "pipe",
		stderr: "pipe",
		stdin: "ignore",
	});

	await Promise.all([drainStream(proc.stdout, ""), drainStream(proc.stderr, "[stderr] ")]);

	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		throw new Error(`Comando falhou (exit ${exitCode}): ${command.join(" ")}`);
	}
}

await log("=== Redeploy remoto iniciado ===");

try {
	await runCommand("git fetch", ["git", "fetch", "origin"]);
	await runCommand("git pull", ["git", "pull", "--ff-only"]);
	await runCommand("deploy:fast", ["bun", "run", "deploy:fast"]);
	await log("=== Redeploy concluído com sucesso ===");
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	await log(`=== Redeploy falhou: ${message} ===`);
	process.exitCode = 1;
} finally {
	await rm(lockPath, { force: true });
}
