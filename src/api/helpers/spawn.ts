// O serviço roda sob systemd --user, cujo PATH depende do ambiente importado no login e pode não
// conter os diretórios onde os CLIs dos agentes moram (`claude` em ~/.local/bin, `codex` em
// ~/.bun/bin). Garante os dois no PATH do filho pra execução não depender de como o serviço subiu.
function spawnEnv(extra?: Record<string, string>): Record<string, string | undefined> {
	const parts = (process.env.PATH ?? "").split(":").filter(Boolean);
	const home = process.env.HOME;
	if (home) {
		for (const dir of [`${home}/.local/bin`, `${home}/.bun/bin`]) {
			if (!parts.includes(dir)) {
				parts.push(dir);
			}
		}
	}

	return { ...process.env, ...extra, PATH: parts.join(":") };
}

// Roda um processo capturando stdout com teto de tempo: o timer mata o processo e sinaliza o
// estouro por `timedOut`. Neutro de propósito — o chamador decide como tratar (o autofill vira
// ORPCError; o runner de fluxo vira um evento de falha). Padrão de `terminal/tmux.ts`: stdout em
// pipe lido por `new Response(proc.stdout).text()`, sincronizado com `proc.exited`.
export async function spawnCapture(params: {
	cmd: string[];
	cwd: string;
	timeoutMs: number;
	env?: Record<string, string>;
}): Promise<{ stdout: string; exitCode: number; timedOut: boolean }> {
	const env = spawnEnv(params.env);

	if (!Bun.which(params.cmd[0], { PATH: env.PATH })) {
		throw new Error(
			`O comando "${params.cmd[0]}" não foi encontrado no PATH do servidor — verifique a instalação do CLI no computador que executa o Kowork.`,
		);
	}

	const proc = Bun.spawn(params.cmd, {
		cwd: params.cwd,
		stdout: "pipe",
		stderr: "ignore",
		stdin: "ignore",
		env,
	});

	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		proc.kill();
	}, params.timeoutMs);

	const stdoutPromise = new Response(proc.stdout).text();
	const exitCode = await proc.exited;
	clearTimeout(timer);
	const stdout = await stdoutPromise;

	return { stdout, exitCode, timedOut };
}
