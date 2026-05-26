import {
	access,
	chmod,
	copyFile,
	cp,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

import { KOWORK_PROD_API_ORIGIN } from "../../src/lib/runtime-config";

type BumpType = "patch" | "minor" | "major";

const rootDir = process.cwd();

function run(command: string[], cwd = rootDir, env?: Record<string, string>) {
	const result = Bun.spawnSync(command, {
		cwd,
		env: env ? { ...process.env, ...env } : process.env,
		stdio: ["inherit", "inherit", "inherit"],
	});

	if (result.exitCode !== 0) {
		throw new Error(`Comando falhou: ${command.join(" ")}`);
	}
}

function capture(command: string[], cwd = rootDir) {
	const result = Bun.spawnSync(command, { cwd, stdio: ["ignore", "pipe", "pipe"] });

	if (result.exitCode !== 0) {
		throw new Error(`Comando falhou: ${command.join(" ")}`);
	}

	return result.stdout.toString().trim();
}

function commandExists(commandName: string): boolean {
	const result = Bun.spawnSync(["bash", "-lc", `command -v ${commandName} >/dev/null 2>&1`], {
		stdio: ["ignore", "ignore", "ignore"],
	});

	return result.exitCode === 0;
}

function resolveTargetRef() {
	const hasMaster =
		Bun.spawnSync(["git", "show-ref", "--verify", "--quiet", "refs/remotes/origin/master"], {
			stdio: ["ignore", "ignore", "ignore"],
		}).exitCode === 0;

	if (hasMaster) {
		return { ref: "origin/master", branch: "master" };
	}

	const hasMain =
		Bun.spawnSync(["git", "show-ref", "--verify", "--quiet", "refs/remotes/origin/main"], {
			stdio: ["ignore", "ignore", "ignore"],
		}).exitCode === 0;

	if (hasMain) {
		return { ref: "origin/main", branch: "main" };
	}

	throw new Error("Nenhuma branch remota origin/master ou origin/main foi encontrada.");
}

function bumpVersion(currentVersion: string, bumpType: BumpType): string {
	const [majorRaw, minorRaw, patchRaw] = currentVersion.split(".");
	const major = Number(majorRaw);
	const minor = Number(minorRaw);
	const patch = Number(patchRaw);

	if ([major, minor, patch].some((part) => Number.isNaN(part))) {
		throw new Error(`Versao invalida: ${currentVersion}`);
	}

	if (bumpType === "patch") {
		return `${major}.${minor}.${patch + 1}`;
	}

	if (bumpType === "minor") {
		return `${major}.${minor + 1}.0`;
	}

	return `${major + 1}.0.0`;
}

async function chooseBumpType(currentVersion: string): Promise<BumpType> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });

	console.log(`\nVersao atual da master: ${currentVersion}`);
	console.log("Escolha o tipo de atualizacao:");
	console.log("1) patch (0.0.1)");
	console.log("2) versionamento/minor (0.1.0)");
	console.log("3) nova versao major (1.0.0)");

	const answer = (await rl.question("Tipo [1/2/3]: ")).trim().toLowerCase();
	rl.close();

	if (answer === "1" || answer === "patch" || answer === "p") return "patch";
	if (answer === "2" || answer === "minor" || answer === "m") return "minor";
	if (answer === "3" || answer === "major") return "major";

	throw new Error("Escolha invalida. Use 1, 2 ou 3.");
}

async function updateVersions(worktreeDir: string, nextVersion: string) {
	const packageJsonPath = join(worktreeDir, "package.json");
	const tauriConfigPath = join(worktreeDir, "src-tauri", "tauri.conf.json");
	const cargoTomlPath = join(worktreeDir, "src-tauri", "Cargo.toml");

	const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
		version?: string;
	};
	packageJson.version = nextVersion;
	await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, "\t")}\n`);

	const tauriConfig = JSON.parse(await readFile(tauriConfigPath, "utf8")) as {
		version?: string;
	};
	tauriConfig.version = nextVersion;
	await writeFile(tauriConfigPath, `${JSON.stringify(tauriConfig, null, "\t")}\n`);

	const cargoToml = await readFile(cargoTomlPath, "utf8");
	const nextCargoToml = cargoToml.replace(
		/(\[package\][\s\S]*?\nversion\s*=\s*")([^"]+)(")/,
		`$1${nextVersion}$3`,
	);

	if (nextCargoToml === cargoToml) {
		throw new Error("Nao foi possivel atualizar a versao em src-tauri/Cargo.toml");
	}

	await writeFile(cargoTomlPath, nextCargoToml);
}

async function pathExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function findArtifact(
	bundleDir: string,
	folder: string,
	extension: string,
): Promise<string | null> {
	const dir = join(bundleDir, folder);
	if (!(await pathExists(dir))) {
		return null;
	}

	const files = await readdir(dir);
	const found = files.find((file) => file.endsWith(extension));
	return found ? join(dir, found) : null;
}

function withElevation(command: string[]): string[] {
	if (typeof process.getuid === "function" && process.getuid() === 0) {
		return command;
	}

	if (!commandExists("sudo")) {
		throw new Error("Necessario sudo para instalar pacote no sistema.");
	}

	return ["sudo", ...command];
}

async function installLocally(worktreeDir: string) {
	const binaryPath = join(worktreeDir, "src-tauri", "target", "release", "kowork");
	if (!(await pathExists(binaryPath))) {
		throw new Error("Executavel de release nao encontrado para instalacao local.");
	}

	const home = process.env.HOME;
	if (!home) {
		throw new Error("Variavel HOME nao encontrada.");
	}

	const localBinDir = join(home, ".local", "bin");
	const localBinaryPath = join(localBinDir, "kowork");
	const appDir = join(home, ".local", "share", "applications");
	const iconDir = join(home, ".local", "share", "icons", "hicolor", "128x128", "apps");
	const desktopPath = join(appDir, "kowork.desktop");
	const iconSource = join(worktreeDir, "src-tauri", "icons", "128x128.png");
	const iconTarget = join(iconDir, "kowork.png");

	await mkdir(localBinDir, { recursive: true });
	await copyFile(binaryPath, localBinaryPath);
	await chmod(localBinaryPath, 0o755);

	const appDataDir = join(home, ".local", "share", "com.pedro.kowork");
	const backendBinDir = join(home, ".local", "lib", "kowork", "bin");
	const backendSource = join(worktreeDir, "src-tauri", "bin", "kowork-backend");
	const distSource = join(worktreeDir, "dist");

	if (await pathExists(backendSource)) {
		await mkdir(backendBinDir, { recursive: true });
		await copyFile(backendSource, join(backendBinDir, "kowork-backend"));
		await chmod(join(backendBinDir, "kowork-backend"), 0o755);
	}

	if (await pathExists(distSource)) {
		const distTarget = join(appDataDir, "dist");
		await rm(distTarget, { force: true, recursive: true });
		await mkdir(appDataDir, { recursive: true });
		await cp(distSource, distTarget, { recursive: true });
	}

	await mkdir(appDir, { recursive: true });
	await mkdir(iconDir, { recursive: true });
	if (await pathExists(iconSource)) {
		await copyFile(iconSource, iconTarget);
	}

	const desktopFile = `[Desktop Entry]\nType=Application\nName=Kowork\nComment=Kowork Desktop\nExec=${localBinaryPath}\nIcon=kowork\nTerminal=false\nCategories=Development;ProjectManagement;\nStartupNotify=true\n`;
	await writeFile(desktopPath, desktopFile);

	if (commandExists("update-desktop-database")) {
		run(["update-desktop-database", appDir]);
	}

	return `binario local atualizado em ${localBinaryPath}`;
}

async function fallbackPrepare(worktreeDir: string) {
	const distDir = join(worktreeDir, "dist");
	await rm(distDir, { force: true, recursive: true });
	await mkdir(distDir, { recursive: true });

	run(["bun", "build", "src/main.tsx", "--outdir", "dist", "--target", "browser"], worktreeDir);
	run(
		["bun", "x", "@tailwindcss/cli", "-i", "src/index.css", "-o", "dist/index.css", "--minify"],
		worktreeDir,
	);

	const sourceIndex = await readFile(join(worktreeDir, "src", "index.html"), "utf8");
	const builtIndex = sourceIndex
		.replace("./main.tsx", "./main.js")
		.replace(
			'window.__KOWORK_ENV__ = "development";',
			`window.__KOWORK_ENV__ = "production";\n      window.__KOWORK_API_URL__ = "${KOWORK_PROD_API_ORIGIN}";`,
		);
	await writeFile(join(distDir, "index.html"), builtIndex);

	const staticDir = join(worktreeDir, "static");
	if (await pathExists(staticDir)) {
		await cp(staticDir, join(distDir, "static"), { recursive: true });
	}

	await mkdir(join(worktreeDir, "src-tauri", "bin"), { recursive: true });
	run(
		["bun", "build", "src/server.ts", "--compile", "--outfile", "src-tauri/bin/kowork-backend"],
		worktreeDir,
		{
			DATABASE_URL: "/tmp/kowork-build.db",
			JWT_SECRET: "kowork-build-secret",
			NODE_ENV: "production",
		},
	);
	await chmod(join(worktreeDir, "src-tauri", "bin", "kowork-backend"), 0o755);
}

async function main() {
	run(["git", "fetch", "origin", "--prune"]);

	const target = resolveTargetRef();
	const worktreeDir = await mkdtemp(join(tmpdir(), "kowork-deploy-"));

	try {
		run(["git", "worktree", "add", "--detach", worktreeDir, target.ref]);

		const packageJsonPath = join(worktreeDir, "package.json");
		const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
			version?: string;
			scripts?: Record<string, string>;
		};
		const currentVersion = packageJson.version || "0.0.0";
		const bumpType = await chooseBumpType(currentVersion);
		const nextVersion = bumpVersion(currentVersion, bumpType);

		await updateVersions(worktreeDir, nextVersion);

		run(["bun", "install", "--frozen-lockfile", "--cwd", worktreeDir]);

		if (packageJson.scripts?.["desktop:build"]) {
			run(["bun", "run", "--cwd", worktreeDir, "desktop:build"]);
		} else {
			if (packageJson.scripts?.["desktop:prepare"]) {
				run(["bun", "run", "--cwd", worktreeDir, "desktop:prepare"]);
			} else {
				await fallbackPrepare(worktreeDir);
			}

			run(["cargo", "tauri", "build"], worktreeDir);
		}

		const bundleDir = join(worktreeDir, "src-tauri", "target", "release", "bundle");
		const debFile = await findArtifact(bundleDir, "deb", ".deb");
		const rpmFile = await findArtifact(bundleDir, "rpm", ".rpm");

		let installMessage = "";
		if (debFile && commandExists("dpkg")) {
			run(withElevation(["dpkg", "-i", debFile]));
			installMessage = `pacote DEB instalado: ${debFile}`;
		} else if (rpmFile && commandExists("rpm")) {
			run(withElevation(["rpm", "-Uvh", "--replacepkgs", rpmFile]));
			installMessage = `pacote RPM instalado: ${rpmFile}`;
		} else {
			installMessage = await installLocally(worktreeDir);
		}

		const shortSha = capture(["git", "-C", worktreeDir, "rev-parse", "--short", "HEAD"]);
		const stamp = new Date()
			.toISOString()
			.split("-")
			.join("")
			.split(":")
			.join("")
			.replace(/\..+/, "")
			.replace("T", "-");
		const releaseDir = join(
			rootDir,
			"releases",
			"linux",
			`${target.branch}-${shortSha}-${nextVersion}-${stamp}`,
		);
		const latestLink = join(rootDir, "releases", "linux", "latest");

		await mkdir(releaseDir, { recursive: true });
		if (await pathExists(bundleDir)) {
			await cp(bundleDir, join(releaseDir, "bundle"), { recursive: true });
		}
		const releaseBinary = join(worktreeDir, "src-tauri", "target", "release", "kowork");
		if (await pathExists(releaseBinary)) {
			await copyFile(releaseBinary, join(releaseDir, "kowork"));
			await chmod(join(releaseDir, "kowork"), 0o755);
		}

		await rm(latestLink, { force: true, recursive: true });
		await symlink(releaseDir, latestLink);

		console.log(`\nDeploy concluido com sucesso.`);
		console.log(`Branch base: ${target.ref}`);
		console.log(`Versao anterior: ${currentVersion}`);
		console.log(`Nova versao: ${nextVersion}`);
		console.log(`Instalacao: ${installMessage}`);
		console.log(`Artefatos em: ${releaseDir}`);
	} finally {
		run(["git", "-C", rootDir, "worktree", "remove", "--force", worktreeDir]);
		await rm(worktreeDir, { force: true, recursive: true });
	}
}

await main();
