import { argvToShellCommand } from "@/lib/shell-argv";

import { spawnEnv } from "./spawn";

// O backend roda sob systemd --user (kowork-backend.service). Todo filho que ele spawna direto
// nasce DENTRO do cgroup do serviço e recebe SIGTERM junto no restart — foi assim que o deploy
// derrubava o kw-terminal server e, com ele, todas as panes e agents. `unref()` só solta a
// referência do event loop; não move processo de cgroup. A saída é nascer fora: `systemd-run
// --user` cria uma unidade transitória irmã, dona do próprio cgroup, imune ao ciclo de vida do
// backend. Sem systemd disponível, cai no spawn direto (que sobrevive ao restart enquanto o
// drop-in KillMode=process da unidade do backend existir).
export function buildSystemdRunArgv(params: {
	unit: string;
	description: string;
	argv: string[];
	env?: Record<string, string>;
	cwd?: string;
	loginShell?: boolean;
}): string[] {
	const command = params.loginShell
		? ["bash", "-lc", `exec ${argvToShellCommand(params.argv)}`]
		: params.argv;
	const argv = [
		"systemd-run",
		"--user",
		"--collect",
		`--unit=${params.unit}`,
		`--description=${params.description}`,
	];

	if (params.cwd) {
		argv.push(`--working-directory=${params.cwd}`);
	}

	const extraPath = spawnEnv().PATH;
	if (extraPath) {
		argv.push(`--setenv=PATH=${extraPath}`);
	}

	for (const [key, value] of Object.entries(params.env ?? {})) {
		argv.push(`--setenv=${key}=${value}`);
	}

	argv.push("--");
	argv.push(...command);

	return argv;
}

export type DetachedSpawnResult = { via: "systemd" | "direct"; error?: string };

function launchDirect(argv: string[], cwd?: string): void {
	Bun.spawn(argv, {
		cwd,
		stdin: "ignore",
		stdout: "ignore",
		stderr: "ignore",
		env: spawnEnv(),
	}).unref();
}

// Dispara `argv` desacoplado do ciclo de vida do backend. Falha do systemd-run não é erro fatal:
// registra o motivo e segue no spawn direto, para o recurso funcionar fora de máquinas com systemd.
export function spawnDetachedFromService(params: {
	unit: string;
	description: string;
	argv: string[];
	env?: Record<string, string>;
	cwd?: string;
	loginShell?: boolean;
	log?: (message: string) => void;
}): DetachedSpawnResult {
	const log = params.log ?? (() => {});

	if (Bun.which("systemd-run")) {
		const first = Bun.spawnSync(buildSystemdRunArgv(params), {
			stdin: "ignore",
			stdout: "ignore",
			stderr: "pipe",
		});

		if (first.exitCode === 0) {
			return { via: "systemd" };
		}

		// Unidade travada de uma execução anterior impede o nome de novo: limpa e tenta uma vez.
		Bun.spawnSync(["systemctl", "--user", "reset-failed", params.unit], {
			stdin: "ignore",
			stdout: "ignore",
			stderr: "ignore",
		});

		const retry = Bun.spawnSync(buildSystemdRunArgv(params), {
			stdin: "ignore",
			stdout: "ignore",
			stderr: "pipe",
		});

		if (retry.exitCode === 0) {
			return { via: "systemd" };
		}

		const error =
			retry.stderr.toString().trim() ||
			first.stderr.toString().trim() ||
			`systemd-run saiu com código ${retry.exitCode || first.exitCode}`;
		log(`systemd-run não conseguiu lançar ${params.unit}: ${error}. Seguindo com spawn direto.`);

		return { via: "direct", error };
	}

	log("systemd-run indisponível; spawn direto dentro do cgroup do serviço.");
	const command = params.loginShell
		? ["bash", "-lc", `exec ${argvToShellCommand(params.argv)}`]
		: params.argv;
	launchDirect(command, params.cwd);

	return { via: "direct" };
}
