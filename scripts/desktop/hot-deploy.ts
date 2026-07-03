import { access, chmod, cp, mkdir, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { koworkerDataDir } from "../../src/lib/app-paths";
import { KOWORK_PROD_PORT } from "../../src/lib/runtime-config";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptDir, "../..");
const home = homedir();

const distSource = join(rootDir, "dist");
const guiSource = join(rootDir, "src-tauri/target/release/kowork");
const backendSource = join(rootDir, "src-tauri/bin/kowork-backend");

const appDataDir = koworkerDataDir();
const distTarget = join(appDataDir, "dist");
const guiTarget = join(home, ".local/bin/kowork");
const backendTargetDir = join(home, ".local/lib/kowork/bin");
const backendTarget = join(backendTargetDir, "kowork-backend");

const healthUrl = `http://localhost:${KOWORK_PROD_PORT}/index.html`;
const systemdBackendUnit = "kowork-backend.service";

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

// KOWORK_SHOW_ON_START faz a GUI abrir a janela ja visivel (ela sobe oculta na tray por padrao).
function launchGui() {
	Bun.spawnSync(["setsid", "-f", guiTarget], {
		env: { ...process.env, KOWORK_SHOW_ON_START: "1" },
		stdio: ["ignore", "ignore", "ignore"],
	});
}

async function waitFor(check: () => Promise<boolean>, timeoutMs: number, stepMs: number) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (await check()) return true;
		await Bun.sleep(stepMs);
	}
	return false;
}

// Instala via temp no MESMO filesystem do alvo + rename atomico. rename sobre um binario em
// execucao e seguro no Linux (o processo antigo mantem o inode; novos exec pegam o novo), e
// se algo falhar o alvo antigo permanece intacto.
async function installFile(src: string, dest: string) {
	const tmp = `${dest}.new`;
	await mkdir(dirname(dest), { recursive: true });
	await rm(tmp, { force: true });
	await cp(src, tmp);
	await chmod(tmp, 0o755);
	await rename(tmp, dest);
}

async function installDir(src: string, dest: string) {
	const tmp = `${dest}.tmp`;
	await rm(tmp, { force: true, recursive: true });
	await cp(src, tmp, { recursive: true });
	await rm(dest, { force: true, recursive: true });
	await rename(tmp, dest);
}

console.log("→ Gerando route tree (TanStack Router)...");
run(["bunx", "tsr", "generate"]);

console.log("→ Build do frontend (dist)...");
run(["bun", "run", "build:web"]);

console.log("→ Build do backend (binario standalone)...");
run(["bun", "run", "build:backend"]);

console.log("→ cargo tauri build (re-embute o frontend novo na GUI)...");
run(["cargo", "tauri", "build", "--no-bundle"]);

if (!(await pathExists(guiSource))) {
	throw new Error(`cargo nao gerou a GUI em ${guiSource}`);
}
if (!(await pathExists(backendSource))) {
	throw new Error("build:backend nao gerou src-tauri/bin/kowork-backend");
}
if (!(await pathExists(join(distSource, "index.html")))) {
	throw new Error("build:web nao gerou dist/index.html");
}

// Instala com prod antigo ainda no ar; os renames atomicos so trocam tudo no fim.
console.log("→ Instalando GUI, backend e dist...");
await installFile(guiSource, guiTarget);
await installFile(backendSource, backendTarget);
await installDir(distSource, distTarget);

console.log("→ Reiniciando o app de prod...");
const backendManagedBySystemd = systemdBackendUnitExists();

try {
	kill(guiTarget);

	if (backendManagedBySystemd) {
		// Nao usar pkill no backend: systemd ressuscitaria o processo antigo (inode velho) no meio do deploy.
		restartBackendViaSystemd();
		const live = await waitForBackendHealth(40000, 500);
		if (!live) {
			throw new Error(
				`Backend systemd nao respondeu 200 em ${healthUrl} apos restart de ${systemdBackendUnit}.`,
			);
		}
	} else {
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
	}

	launchGui();
} catch (error) {
	launchGui();
	throw error;
}

const live = backendManagedBySystemd ? true : await waitForBackendHealth(40000, 500);

if (!live) {
	throw new Error(`Prod nao respondeu 200 em ${healthUrl} apos relancar a GUI.`);
}

console.log(
	`\n✅ Deploy concluido. Prod (frontend + backend) no ar em http://localhost:${KOWORK_PROD_PORT}`,
);
