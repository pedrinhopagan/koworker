import { access, chmod, cp, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { koworkerDataDir } from "../../src/lib/app-paths";
import { KOWORK_PROD_PORT } from "../../src/lib/runtime-config";
import { installSharpVendor } from "./install-sharp-vendor";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptDir, "../..");
const home = homedir();

const distSource = join(rootDir, "dist");
const guiSource = join(rootDir, "src-tauri/target/release/kowork");
const backendSource = join(rootDir, "src-tauri/bin/kowork-backend");
const cliSource = join(rootDir, "src-tauri/bin/kw-cli");

const appDataDir = koworkerDataDir();
const distTarget = join(appDataDir, "dist");
const guiTarget = join(home, ".local/bin/kowork");
const cliTarget = join(home, ".local/bin/kw-cli");
const backendTargetDir = join(home, ".local/lib/kowork/bin");
const backendTarget = join(backendTargetDir, "kowork-backend");
const backendEnvPath = join(appDataDir, "backend.env");

const healthUrl = `http://localhost:${KOWORK_PROD_PORT}/index.html`;
const systemdBackendUnit = "kowork-backend.service";
const deploymentId = new Date().toISOString().replaceAll(":", "-");
const deploymentBackupRoot = join(home, "Documents", "backups", "kowork-hot-deploy", deploymentId);
const installedTargets: { dest: string; backup: string | null; kind: "file" | "dir" }[] = [];

function run(command: string[], env?: Record<string, string>) {
	const result = Bun.spawnSync(command, {
		cwd: rootDir,
		env: env ? { ...process.env, ...env } : process.env,
		stdio: ["ignore", "inherit", "inherit"],
	});

	if (result.exitCode !== 0) {
		throw new Error(`Comando falhou: ${command.join(" ")}`);
	}
}

function runAllowingFailure(command: string[]): string | null {
	const result = Bun.spawnSync(command, {
		cwd: rootDir,
		env: process.env,
		stdio: ["ignore", "inherit", "inherit"],
	});

	if (result.exitCode === 0) {
		return null;
	}

	return `${command.join(" ")} saiu com codigo ${result.exitCode}`;
}

async function pathExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

// Padrao ancorado em ^: casa o caminho absoluto no inicio da argv. Assim nao atinge o app de dev
// (target/debug/kowork), nem o backend (caminho diferente), nem a propria linha de relancamento
// (que comeca com "setsid"), nem o build (outfile em src-tauri/bin).
function kill(absolutePath: string, signal?: string) {
	const args = signal ? ["-f", signal, `^${absolutePath}`] : ["-f", `^${absolutePath}`];
	Bun.spawnSync(["pkill", ...args], { stdio: ["ignore", "ignore", "ignore"] });
}

async function portOccupied(): Promise<boolean> {
	try {
		await fetch(healthUrl, { signal: AbortSignal.timeout(800) });
		return true;
	} catch {
		return false;
	}
}

async function persistRepoDirForBackend() {
	const content = (await pathExists(backendEnvPath)) ? await readFile(backendEnvPath, "utf8") : "";
	const prefix = "KOWORK_REPO_DIR=";
	const lines = content
		.trimEnd()
		.split("\n")
		.filter((line) => line && !line.startsWith(prefix));

	lines.push(`${prefix}${JSON.stringify(rootDir)}`);

	await mkdir(appDataDir, { recursive: true });
	await writeFile(backendEnvPath, `${lines.join("\n")}\n`);
}

function systemdBackendUnitExists(): boolean {
	const result = Bun.spawnSync(["systemctl", "--user", "cat", systemdBackendUnit], {
		stdio: ["ignore", "ignore", "ignore"],
	});
	return result.exitCode === 0;
}

function restartBackendViaSystemd() {
	console.log(`→ Reiniciando backend via systemd (${systemdBackendUnit})...`);
	run(["systemctl", "--user", "restart", systemdBackendUnit]);
}

function waitForBackendHealth(timeoutMs: number, stepMs: number): Promise<boolean> {
	return waitFor(
		async () => {
			try {
				const res = await fetch(healthUrl, { signal: AbortSignal.timeout(1000) });
				return res.ok;
			} catch {
				return false;
			}
		},
		timeoutMs,
		stepMs,
	);
}

// --show faz a GUI abrir a janela ja visivel (ela sobe oculta na tray por padrao).
function launchGui() {
	Bun.spawnSync(["setsid", "-f", guiTarget, "--show"], {
		stdio: ["ignore", "ignore", "ignore"],
	});
}

async function guiGone() {
	const proc = Bun.spawn(["pgrep", "-f", `^${guiTarget}`], {
		stdio: ["ignore", "ignore", "ignore"],
	});
	return (await proc.exited) !== 0;
}

async function waitFor(check: () => Promise<boolean>, timeoutMs: number, stepMs: number) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (await check()) return true;
		await Bun.sleep(stepMs);
	}
	return false;
}

function targetBackupPath(dest: string) {
	return join(deploymentBackupRoot, "targets", dest.split("/").filter(Boolean).join("__"));
}

async function installFile(src: string, dest: string) {
	const tmp = `${dest}.new.${crypto.randomUUID()}`;
	const backup = (await pathExists(dest)) ? targetBackupPath(dest) : null;
	await mkdir(dirname(dest), { recursive: true });
	if (backup) {
		await mkdir(dirname(backup), { recursive: true });
		await cp(dest, backup);
	}
	await cp(src, tmp);
	await chmod(tmp, 0o755);
	await rename(tmp, dest);
	installedTargets.push({ dest, backup, kind: "file" });
}

async function installDir(src: string, dest: string) {
	const tmp = `${dest}.tmp.${crypto.randomUUID()}`;
	const backup = (await pathExists(dest)) ? targetBackupPath(dest) : null;
	await mkdir(dirname(dest), { recursive: true });
	await cp(src, tmp, { recursive: true });
	if (backup) {
		await mkdir(dirname(backup), { recursive: true });
		await rename(dest, backup);
	}
	installedTargets.push({ dest, backup, kind: "dir" });
	await rename(tmp, dest);
}

async function restoreInstalledTargets() {
	for (const target of installedTargets.toReversed()) {
		if (await pathExists(target.dest)) {
			const failed = join(
				deploymentBackupRoot,
				"failed-release",
				target.dest.split("/").filter(Boolean).join("__"),
			);
			await mkdir(dirname(failed), { recursive: true });
			await rename(target.dest, failed);
		}
		if (!target.backup) continue;
		if (target.kind === "dir") {
			await rename(target.backup, target.dest);
			continue;
		}
		const tmp = `${target.dest}.restore.${crypto.randomUUID()}`;
		await cp(target.backup, tmp);
		await chmod(tmp, 0o755);
		await rename(tmp, target.dest);
	}
}

const backendManagedBySystemd = systemdBackendUnitExists();
const warnings: string[] = [];

console.log("→ Build do frontend (route tree + dist)...");
run(["bun", "run", "build:web"]);

console.log("→ Build do backend (binario standalone)...");
run(["bun", "run", "build:backend"]);

console.log("→ Build da CLI (binario standalone)...");
run(["bun", "build", "src/cli/index.ts", "--compile", "--outfile", cliSource]);

let guiAvailable = false;

if (backendManagedBySystemd) {
	warnings.push(
		`Backend gerenciado por systemd (${systemdBackendUnit}): build e relancamento da GUI foram pulados nesta maquina.`,
	);
} else {
	console.log("→ cargo tauri build (re-embute o frontend novo na GUI)...");
	const cargoError = runAllowingFailure(["cargo", "tauri", "build", "--no-bundle"]);

	if (cargoError) {
		warnings.push(`Build da GUI falhou (${cargoError}); dist, backend e CLI seguiram mesmo assim.`);
	} else if (await pathExists(guiSource)) {
		guiAvailable = true;
	} else {
		warnings.push(
			`cargo nao gerou a GUI em ${guiSource}; dist, backend e CLI seguiram mesmo assim.`,
		);
	}
}

if (!(await pathExists(backendSource))) {
	throw new Error("build:backend nao gerou src-tauri/bin/kowork-backend");
}
if (!(await pathExists(cliSource))) {
	throw new Error("build da CLI nao gerou src-tauri/bin/kw-cli");
}
if (!(await pathExists(join(distSource, "index.html")))) {
	throw new Error("build:web nao gerou dist/index.html");
}

if (backendManagedBySystemd) {
	await persistRepoDirForBackend();
}

// Instala com prod antigo ainda no ar; os renames atomicos so trocam tudo no fim.
try {
	console.log("→ Instalando backend, CLI, dist e vendor do sharp...");
	if (guiAvailable) {
		await installFile(guiSource, guiTarget);
	}
	await installFile(backendSource, backendTarget);
	await installFile(cliSource, cliTarget);
	await installDir(distSource, distTarget);
	await installSharpVendor(rootDir);

	console.log("→ Reiniciando o app de prod...");
	if (guiAvailable) {
		kill(guiTarget);

		const guiDead = await waitFor(guiGone, 5000, 100);
		if (!guiDead) {
			kill(guiTarget, "-KILL");
			await waitFor(guiGone, 3000, 100);
		}
	}

	if (backendManagedBySystemd) {
		// Nao usar pkill no backend: systemd ressuscitaria o processo antigo (inode velho) no meio do deploy.
		restartBackendViaSystemd();
		const live = await waitForBackendHealth(40000, 500);
		if (!live) {
			throw new Error(
				`Backend systemd nao respondeu 200 em ${healthUrl} apos restart de ${systemdBackendUnit}.`,
			);
		}
	} else if (guiAvailable) {
		kill(backendTarget);

		const freed = await waitFor(async () => !(await portOccupied()), 6000, 200);
		if (!freed) {
			kill(backendTarget, "-KILL");
			const freedHard = await waitFor(async () => !(await portOccupied()), 4000, 200);
			if (!freedHard) {
				throw new Error(
					`Porta ${KOWORK_PROD_PORT} segue ocupada por um backend antigo; abortando para nao servir codigo defasado.`,
				);
			}
		}

		launchGui();
		const live = await waitForBackendHealth(40000, 500);
		if (!live) {
			throw new Error(`Prod nao respondeu 200 em ${healthUrl} apos relancar a GUI.`);
		}
	} else {
		warnings.push(
			`Sem GUI e sem unidade systemd (${systemdBackendUnit}): os artefatos novos ficaram instalados, mas o backend antigo segue no ar. Reinicie o backend manualmente.`,
		);
	}
} catch (error) {
	await restoreInstalledTargets();
	if (backendManagedBySystemd) {
		restartBackendViaSystemd();
	}
	if (guiAvailable) {
		launchGui();
	}
	throw error;
}

for (const warning of warnings) {
	console.warn(`⚠️  ${warning}`);
}

console.log(
	`\n✅ Deploy concluido. Prod (frontend + backend) no ar em http://localhost:${KOWORK_PROD_PORT}`,
);
