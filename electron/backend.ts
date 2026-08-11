import { randomBytes, randomUUID } from "node:crypto";
import { access, chmod, cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

import { app } from "electron";

import { koworkerDataDir } from "../src/lib/app-paths";
import { DEFAULT_KOWORK_PORT, KOWORK_PROD_PORT } from "../src/lib/runtime-config";

const BACKEND_STOP_TIMEOUT_MS = 5_000;
const BACKEND_START_TIMEOUT_MS = 60_000;

function backendFileName() {
	return process.platform === "win32" ? "kowork-backend.exe" : "kowork-backend";
}

function bunExecutable() {
	const npmExecPath = process.env.npm_execpath;

	return npmExecPath && /^bun(?:\.exe)?$/u.test(basename(npmExecPath)) ? npmExecPath : "bun";
}

function installedBackendPath(dataDir: string) {
	if (process.platform === "linux") {
		return join(homedir(), ".local", "lib", "kowork", "bin", backendFileName());
	}

	return join(dataDir, "bin", backendFileName());
}

async function pathExists(path: string) {
	return await access(path)
		.then(() => true)
		.catch(() => false);
}

async function replaceDirectory(source: string, target: string) {
	const staging = `${target}.staging.${randomUUID()}`;

	await rm(staging, { force: true, recursive: true });
	await mkdir(dirname(target), { recursive: true });
	await cp(source, staging, { recursive: true, dereference: true });
	await rm(target, { force: true, recursive: true });
	await rename(staging, target);
}

async function replaceFile(source: string, target: string) {
	const staging = `${target}.staging.${randomUUID()}`;

	await mkdir(dirname(target), { recursive: true });
	await cp(source, staging);
	await chmod(staging, 0o755);
	await rm(target, { force: true });
	await rename(staging, target);
}

async function preparePackagedRuntime() {
	const dataDir = koworkerDataDir();
	const markerPath = join(dataDir, "desktop-package-version");
	const installedVersion = await readFile(markerPath, "utf8").catch(() => "");

	const bundledBackend = join(process.resourcesPath, "bin", backendFileName());
	const bundledDist = join(process.resourcesPath, "dist");
	const backendTarget = installedBackendPath(dataDir);
	const distTarget = join(dataDir, "dist");
	const runtimeIsCurrent =
		installedVersion.trim() === app.getVersion() &&
		(await pathExists(backendTarget)) &&
		(await pathExists(join(distTarget, "index.html")));

	if (runtimeIsCurrent) {
		return;
	}

	if (!(await pathExists(bundledBackend)) || !(await pathExists(bundledDist))) {
		throw new Error("O pacote desktop não contém backend e frontend de produção");
	}

	await replaceFile(bundledBackend, backendTarget);
	await replaceDirectory(bundledDist, distTarget);

	if (process.platform === "linux") {
		const bundledVendor = join(process.resourcesPath, "vendor", "node_modules", "@img");
		if (await pathExists(bundledVendor)) {
			await replaceDirectory(
				bundledVendor,
				join(homedir(), ".local", "lib", "kowork", "vendor", "node_modules", "@img"),
			);
		}
	}

	await mkdir(dataDir, { recursive: true });
	await writeFile(markerPath, `${app.getVersion()}\n`);
}

async function ensureJwtSecret(dataDir: string) {
	const secretPath = join(dataDir, "jwt.secret");
	const existing = await readFile(secretPath, "utf8").catch(() => "");

	if (existing.trim()) {
		return existing.trim();
	}

	const secret = randomBytes(32).toString("hex");
	await mkdir(dataDir, { recursive: true });
	await writeFile(secretPath, secret, { mode: 0o600 });

	return secret;
}

async function backendIsHealthy(port: number) {
	try {
		const response = await fetch(`http://127.0.0.1:${port}/healthz`, {
			signal: AbortSignal.timeout(1_000),
		});

		return response.ok;
	} catch {
		return false;
	}
}

async function waitForBackend(port: number) {
	const deadline = Date.now() + BACKEND_START_TIMEOUT_MS;

	while (Date.now() < deadline) {
		if (await backendIsHealthy(port)) {
			return;
		}

		await new Promise((resolve) => {
			setTimeout(resolve, 100);
		});
	}

	throw new Error(`Backend não respondeu na porta ${port}`);
}

function waitForExit(child: ChildProcess, timeoutMs: number) {
	return new Promise<boolean>((resolve) => {
		if (child.exitCode !== null || child.signalCode !== null) {
			resolve(true);

			return;
		}

		const timer = setTimeout(() => resolve(false), timeoutMs);
		child.once("exit", () => {
			clearTimeout(timer);
			resolve(true);
		});
	});
}

export class BackendProcess {
	private child: ChildProcess | null = null;

	get port() {
		return app.isPackaged ? KOWORK_PROD_PORT : DEFAULT_KOWORK_PORT;
	}

	async start() {
		if (await backendIsHealthy(this.port)) {
			return;
		}

		const rootDir = app.getAppPath();
		const dataDir = koworkerDataDir();

		if (app.isPackaged) {
			await preparePackagedRuntime();

			const backendPath = installedBackendPath(dataDir);
			await chmod(backendPath, 0o755);
			this.child = spawn(backendPath, [], {
				cwd: dataDir,
				env: {
					...process.env,
					DATABASE_URL: join(dataDir, "kowork.db"),
					JWT_SECRET: await ensureJwtSecret(dataDir),
					NODE_ENV: "production",
					KOWORK_PORT: String(this.port),
					KOWORK_DIST_DIR: join(dataDir, "dist"),
				},
				stdio: ["ignore", "ignore", "inherit"],
			});
		} else {
			this.child = spawn(bunExecutable(), ["--watch", "src/server.ts"], {
				cwd: rootDir,
				env: {
					...process.env,
					NODE_ENV: "development",
					KOWORK_DIST_DIR: "",
					KOWORK_PORT: String(this.port),
				},
				stdio: ["ignore", "ignore", "inherit"],
			});
		}

		this.child.once("exit", () => {
			this.child = null;
		});

		await waitForBackend(this.port);
	}

	async stop() {
		const child = this.child;
		this.child = null;

		if (!child || child.exitCode !== null || child.signalCode !== null) {
			return;
		}

		child.kill("SIGTERM");
		if (await waitForExit(child, BACKEND_STOP_TIMEOUT_MS)) {
			return;
		}

		child.kill("SIGKILL");
		await waitForExit(child, BACKEND_STOP_TIMEOUT_MS);
	}
}
