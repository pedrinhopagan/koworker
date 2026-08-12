import { existsSync } from "node:fs";
import { mkdir, open, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import { ORPCError } from "@orpc/server";

import { envVariables } from "@/api/config/env";
import { koworkerDataDir } from "@/lib/app-paths";
import { readRedeployState, writeRedeployState } from "@/lib/redeploy-state";

const LOCK_MAX_AGE_MS = 15 * 60 * 1000;
const REDEPLOY_SCRIPT = "scripts/desktop/remote-redeploy.ts";
const REDEPLOY_UNIT = "kowork-redeploy";

function dataPaths() {
	const dir = koworkerDataDir();

	return {
		lockPath: join(dir, "redeploy.lock"),
		logPath: join(dir, "redeploy.log"),
	};
}

export function getRepoDir(): string {
	const configured = envVariables.KOWORK_REPO_DIR?.trim();
	const repoDir = configured || (envVariables.NODE_ENV === "production" ? null : process.cwd());

	if (!repoDir) {
		throw new Error(
			"KOWORK_REPO_DIR nao configurado: defina o caminho do repositorio no servico do backend para habilitar o redeploy.",
		);
	}

	if (!existsSync(join(repoDir, "package.json"))) {
		throw new Error(
			`Repositorio nao encontrado em ${repoDir}: ajuste KOWORK_REPO_DIR para o clone do koworker nesta maquina.`,
		);
	}

	return repoDir;
}

async function lockAgeMs(lockPath: string): Promise<number | null> {
	try {
		const info = await stat(lockPath);
		return Date.now() - info.mtimeMs;
	} catch {
		return null;
	}
}

export async function acquireRedeployLock(): Promise<void> {
	const { lockPath } = dataPaths();
	const age = await lockAgeMs(lockPath);

	if (age !== null) {
		if (age < LOCK_MAX_AGE_MS) {
			throw new ORPCError("CONFLICT", { message: "redeploy em andamento" });
		}

		await rm(lockPath, { force: true });
	}

	await mkdir(koworkerDataDir(), { recursive: true });

	try {
		const lock = await open(lockPath, "wx");
		await lock.writeFile(String(Date.now()));
		await lock.close();
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "EEXIST") {
			throw new ORPCError("CONFLICT", { message: "redeploy em andamento" });
		}
		throw error;
	}

	try {
		await writeRedeployState({
			state: "running",
			startedAt: Date.now(),
			finishedAt: null,
			commit: null,
			message: "Preparando atualização",
		});
	} catch (error) {
		await rm(lockPath, { force: true });
		throw error;
	}
}

export async function releaseRedeployLock(): Promise<void> {
	const { lockPath } = dataPaths();
	await rm(lockPath, { force: true });
}

export async function failRedeployStart(message: string): Promise<void> {
	const current = await readRedeployState();
	await writeRedeployState({
		state: "failed",
		startedAt: current.startedAt,
		finishedAt: Date.now(),
		commit: null,
		message,
	});
}

export function spawnRedeployDetached(): void {
	const repoDir = getRepoDir();

	const result = Bun.spawnSync(
		[
			"systemd-run",
			"--user",
			"--collect",
			`--unit=${REDEPLOY_UNIT}`,
			`--working-directory=${repoDir}`,
			`--setenv=KOWORK_REPO_DIR=${repoDir}`,
			"bun",
			"run",
			REDEPLOY_SCRIPT,
		],
		{
			cwd: repoDir,
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
		},
	);

	if (result.exitCode !== 0) {
		const stderr = result.stderr.toString().trim();
		throw new Error(
			stderr ? `systemd-run falhou: ${stderr}` : `systemd-run falhou (exit ${result.exitCode})`,
		);
	}
}

export async function getRedeployStatus() {
	const { lockPath, logPath } = dataPaths();

	const age = await lockAgeMs(lockPath);
	const staleLock = age !== null && age >= LOCK_MAX_AGE_MS;
	const inProgress = age !== null && !staleLock;

	let logTail: string[] = [];

	try {
		const content = await readFile(logPath, "utf8");
		logTail = content.split("\n").filter(Boolean).slice(-50);
	} catch {
		logTail = [];
	}

	const persisted = await readRedeployState();
	const state = inProgress
		? "running"
		: staleLock || persisted.state === "running"
			? "failed"
			: persisted.state;
	const message = staleLock
		? "A atualização parou de responder antes de concluir"
		: !inProgress && persisted.state === "running"
			? "A atualização foi interrompida antes de concluir"
			: persisted.message;

	return { ...persisted, state, message, inProgress, logTail };
}

export function assertAdminUser(userType: string | null | undefined): void {
	if (userType !== "admin") {
		throw new ORPCError("FORBIDDEN", {
			message: "Ação restrita a administradores",
		});
	}
}
