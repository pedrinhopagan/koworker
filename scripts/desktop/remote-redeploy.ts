import { appendFile, mkdir, mkdtemp, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { koworkerDataDir } from "../../src/lib/app-paths";
import { readRedeployState, writeRedeployState } from "../../src/lib/redeploy-state";
import { resolveWorkingTreeSnapshot } from "./wip-snapshot";

const REPO_DIR = process.env.KOWORK_REPO_DIR ?? process.cwd();
const dataDir = koworkerDataDir();
const logPath = join(dataDir, "redeploy.log");
const lockPath = join(dataDir, "redeploy.lock");
const worktreeDir = await mkdtemp(join(tmpdir(), "kowork-remote-deploy-"));
let worktreeMounted = false;
let snapshot: { commit: string; label: string; dirty: boolean } | null = null;
const initialState = await readRedeployState();
const startedAt = initialState.startedAt ?? Date.now();

async function log(message: string) {
	const line = `[${new Date().toISOString()}] ${message}\n`;
	await mkdir(dataDir, { recursive: true });
	await appendFile(logPath, line);
	await utimes(lockPath, new Date(), new Date()).catch(() => {});
}

async function updateState(
	state: "running" | "succeeded" | "failed",
	message: string,
	commit: string | null = null,
) {
	await writeRedeployState({
		state,
		startedAt,
		finishedAt: state === "running" ? null : Date.now(),
		commit,
		message,
	});
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

async function runCommand(label: string, command: string[], cwd = REPO_DIR) {
	await log(`→ ${label}: ${command.join(" ")}`);

	const proc = Bun.spawn(command, {
		cwd,
		env: {
			...process.env,
			KOWORK_REMOTE_REDEPLOY: "1",
			KOWORK_REPO_DIR: REPO_DIR,
			...(snapshot
				? {
						KOWORK_EXPECTED_REVISION: snapshot.label,
						KOWORK_BUILD_REVISION: snapshot.label,
						KOWORK_BUILD_COMMIT: snapshot.commit,
					}
				: {}),
		},
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
	await updateState("running", "Fotografando o estado atual do repositório");
	snapshot = await resolveWorkingTreeSnapshot(REPO_DIR);

	await updateState(
		"running",
		snapshot.dirty
			? `Preparando build de ${snapshot.label} (mudanças não commitadas incluídas)`
			: `Preparando build isolado de ${snapshot.label}`,
		snapshot.commit,
	);

	await runCommand("git worktree", [
		"git",
		"worktree",
		"add",
		"--detach",
		worktreeDir,
		snapshot.commit,
	]);
	worktreeMounted = true;

	await updateState("running", `Instalando dependências de ${snapshot.label}`, snapshot.commit);
	await runCommand("bun install", ["bun", "install", "--frozen-lockfile"], worktreeDir);

	await updateState(
		"running",
		`Compilando frontend e backend (${snapshot.label})`,
		snapshot.commit,
	);
	await runCommand("deploy:fast", ["bun", "run", "deploy:fast"], worktreeDir);

	await updateState(
		"succeeded",
		`Versão ${snapshot.label} publicada e verificada`,
		snapshot.commit,
	);
	await log(`=== Redeploy concluído com sucesso em ${snapshot.label} ===`);
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	await updateState("failed", message);
	await log(`=== Redeploy falhou: ${message} ===`);
	process.exitCode = 1;
} finally {
	if (worktreeMounted) {
		await runCommand("remover worktree", [
			"git",
			"worktree",
			"remove",
			"--force",
			worktreeDir,
		]).catch((error) => log(`Falha ao remover worktree: ${String(error)}`));
	}
	await rm(worktreeDir, { force: true, recursive: true });
	await rm(lockPath, { force: true });
}
