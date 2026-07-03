import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { ORPCError } from "@orpc/server";

import { envVariables } from "@/api/config/env";
import { koworkerDataDir } from "@/lib/app-paths";

const LOCK_MAX_AGE_MS = 15 * 60 * 1000;
const DEFAULT_REPO_DIR = "/mnt/data/Projects/koworker";
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
	return envVariables.KOWORK_REPO_DIR ?? DEFAULT_REPO_DIR;
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

	if (age !== null && age < LOCK_MAX_AGE_MS) {
		throw new ORPCError("CONFLICT", { message: "redeploy em andamento" });
	}

	await mkdir(koworkerDataDir(), { recursive: true });
	await writeFile(lockPath, String(Date.now()));
}

export async function releaseRedeployLock(): Promise<void> {
	const { lockPath } = dataPaths();
	await rm(lockPath, { force: true });
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

export async function getRedeployStatus(): Promise<{ inProgress: boolean; logTail: string[] }> {
	const { lockPath, logPath } = dataPaths();

	let inProgress = false;

	try {
		await stat(lockPath);
		inProgress = true;
	} catch {
		inProgress = false;
	}

	let logTail: string[] = [];

	try {
		const content = await readFile(logPath, "utf8");
		logTail = content.split("\n").filter(Boolean).slice(-50);
	} catch {
		logTail = [];
	}

	return { inProgress, logTail };
}

export function assertAdminUser(userType: string | null | undefined): void {
	if (userType !== "admin") {
		throw new ORPCError("FORBIDDEN", {
			message: "Apenas administradores podem gerenciar atualizações do aplicativo",
		});
	}
}
