import { existsSync } from "node:fs";
import { chmod, mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { sql } from "kysely";
import { z } from "zod";
import { dbAgentSourcePaths } from "@/api/db/agent-source-paths";
import { db } from "@/api/db/connection";
import { dbProjects } from "@/api/db/projects";
import { dbSkillSourcePaths } from "@/api/db/skill-source-paths";
import { koworkerDataDir } from "@/lib/app-paths";
import { parseArgs } from "../args";

const dataDir = koworkerDataDir();
const configPath = join(dataDir, "backup.json");
const passwordPath = join(dataDir, "backup.password");
const stagingDir = join(dataDir, "backup-staging");

const backupConfigSchema = z.object({ repository: z.string().min(1) });

export function runBackup(args: string[]): Promise<void> {
	const [sub, ...rest] = args;

	if (sub === "init") {
		return runBackupInit(rest);
	}
	if (sub === "run" || sub === undefined) {
		return runBackupRun();
	}
	if (sub === "install") {
		return runBackupInstall(rest);
	}
	if (sub === "snapshots") {
		return runBackupSnapshots();
	}

	throw new Error(
		`Subcomando desconhecido: backup ${sub}. Use: backup init | backup run | backup install | backup snapshots`,
	);
}

async function runBackupInit(args: string[]): Promise<void> {
	const { flags } = parseArgs(args);
	const repository = flags.repo?.trim() || join(homedir(), "Backups", "kowork");

	if (!existsSync(passwordPath)) {
		const password = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
		await Bun.write(passwordPath, password);
		await chmod(passwordPath, 0o600);
	}

	if (!repository.includes(":")) {
		await mkdir(repository, { recursive: true });
	}

	await Bun.write(configPath, `${JSON.stringify({ repository }, null, "\t")}\n`);
	await runRestic({ repository }, ["init"]);

	console.log(`✅ Repositório restic criado em ${repository}.`);
	console.log(`Senha em ${passwordPath} — guarde uma cópia; sem ela o backup é ilegível.`);
	console.log("Próximos passos: kw-cli backup run | kw-cli backup install");
}

async function runBackupRun(): Promise<void> {
	const config = await loadConfig();

	await rm(stagingDir, { force: true, recursive: true });
	await mkdir(stagingDir, { recursive: true });
	await sql`VACUUM INTO ${join(stagingDir, "kowork.db")}`.execute(db);

	const [roots, skillPaths, agentPaths] = await Promise.all([
		dbProjects.listRoots(),
		dbSkillSourcePaths.list(),
		dbAgentSourcePaths.list(),
	]);

	const candidates = [
		join(dataDir, "jwt.secret"),
		...roots.map((root) => join(root.main_route, ".koworker")),
		...skillPaths.map((row) => row.path),
		...agentPaths.map((row) => row.path),
	];
	const paths = [
		join(stagingDir, "kowork.db"),
		...new Set(candidates.filter((path) => existsSync(path))),
	];

	await runRestic(config, ["backup", "--tag", "kowork", ...paths]);
	await runRestic(config, [
		"forget",
		"--tag",
		"kowork",
		"--keep-daily",
		"14",
		"--keep-weekly",
		"8",
		"--keep-monthly",
		"12",
		"--prune",
	]);
	await rm(stagingDir, { force: true, recursive: true });

	console.log(`✅ Backup concluído (${paths.length} caminhos).`);
}

async function runBackupInstall(args: string[]): Promise<void> {
	await loadConfig();

	const { flags } = parseArgs(args);
	const calendar = flags.calendar?.trim() || "*-*-* 09,15,21:00:00";
	const unitDir = join(homedir(), ".config", "systemd", "user");
	await mkdir(unitDir, { recursive: true });

	await Bun.write(
		join(unitDir, "kowork-backup.service"),
		`[Unit]
Description=Backup do kowork (restic)

[Service]
Type=oneshot
ExecStart=%h/.local/bin/kw-cli backup run
`,
	);
	await Bun.write(
		join(unitDir, "kowork-backup.timer"),
		`[Unit]
Description=Agenda o backup do kowork

[Timer]
OnCalendar=${calendar}
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
`,
	);

	await spawnChecked(["systemctl", "--user", "daemon-reload"]);
	await spawnChecked(["systemctl", "--user", "enable", "--now", "kowork-backup.timer"]);

	console.log(`✅ Timer instalado (OnCalendar=${calendar}).`);
	console.log("Acompanhe com: systemctl --user list-timers kowork-backup.timer");
}

async function runBackupSnapshots(): Promise<void> {
	const config = await loadConfig();
	await runRestic(config, ["snapshots", "--tag", "kowork", "--compact"]);
}

async function loadConfig(): Promise<z.infer<typeof backupConfigSchema>> {
	const file = Bun.file(configPath);
	if (!(await file.exists())) {
		throw new Error("Backup não configurado. Rode `kw-cli backup init` primeiro.");
	}

	return backupConfigSchema.parse(await file.json());
}

async function runRestic(
	config: z.infer<typeof backupConfigSchema>,
	args: string[],
): Promise<void> {
	await spawnChecked([resticBin(), ...args], {
		RESTIC_REPOSITORY: config.repository,
		RESTIC_PASSWORD_FILE: passwordPath,
	});
}

function resticBin(): string {
	const fallback = join(homedir(), ".local", "bin", "restic");
	const found = Bun.which("restic") ?? (existsSync(fallback) ? fallback : null);
	if (!found) {
		throw new Error(
			"restic não encontrado. Instale com `pacman -S restic` ou coloque o binário em ~/.local/bin.",
		);
	}

	return found;
}

async function spawnChecked(cmd: string[], env?: Record<string, string>): Promise<void> {
	const proc = Bun.spawn(cmd, {
		env: { ...process.env, ...env },
		stdout: "inherit",
		stderr: "inherit",
	});

	const code = await proc.exited;
	if (code !== 0) {
		throw new Error(`${cmd[0]} ${cmd[1] ?? ""} falhou (exit ${code}).`);
	}
}
