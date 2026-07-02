// Wrappers finos sobre o binário `tmux`. O estado de verdade do "que está aberto" vive no tmux (um
// daemon independente que sobrevive ao restart do backend), então lemos dele ao vivo em vez de
// cachear. Cada função roda um subcomando e reporta sucesso/saída.

async function runTmux(args: string[]): Promise<{ ok: boolean; stdout: string }> {
	const proc = Bun.spawn(["tmux", ...args], {
		stdout: "pipe",
		stderr: "ignore",
		stdin: "ignore",
	});
	const stdout = await new Response(proc.stdout).text();
	const code = await proc.exited;

	return { ok: code === 0, stdout };
}

export async function tmuxSessionExists(sessionName: string): Promise<boolean> {
	return (await runTmux(["has-session", "-t", sessionName])).ok;
}

export async function tmuxListWindows(sessionName: string): Promise<string[]> {
	const { ok, stdout } = await runTmux(["list-windows", "-t", sessionName, "-F", "#{window_name}"]);
	if (!ok) {
		return [];
	}

	return stdout
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

export async function tmuxWindowExists(sessionName: string, windowName: string): Promise<boolean> {
	return (await tmuxListWindows(sessionName)).includes(windowName);
}

export async function tmuxNewSession(params: {
	sessionName: string;
	workingDir: string;
	windowName: string;
}): Promise<void> {
	const { ok } = await runTmux([
		"new-session",
		"-d",
		"-s",
		params.sessionName,
		"-n",
		params.windowName,
		"-c",
		params.workingDir,
	]);
	if (!ok) {
		throw new Error("Falha ao criar sessão tmux");
	}
}

export async function tmuxNewWindow(params: {
	sessionName: string;
	windowName: string;
	workingDir: string;
}): Promise<void> {
	const { ok } = await runTmux([
		"new-window",
		"-t",
		params.sessionName,
		"-n",
		params.windowName,
		"-c",
		params.workingDir,
	]);
	if (!ok) {
		throw new Error("Falha ao criar window tmux");
	}
}

export async function tmuxSelectWindow(sessionName: string, windowName: string): Promise<void> {
	await runTmux(["select-window", "-t", `${sessionName}:${windowName}`]);
}

export async function tmuxSendKeys(
	sessionName: string,
	windowName: string,
	command: string,
): Promise<void> {
	const { ok } = await runTmux([
		"send-keys",
		"-t",
		`${sessionName}:${windowName}`,
		command,
		"Enter",
	]);
	if (!ok) {
		throw new Error("Falha ao enviar comando para tmux");
	}
}

export async function tmuxKillSession(sessionName: string): Promise<boolean> {
	return (await runTmux(["kill-session", "-t", sessionName])).ok;
}

export async function tmuxKillWindow(sessionName: string, windowName: string): Promise<boolean> {
	return (await runTmux(["kill-window", "-t", `${sessionName}:${windowName}`])).ok;
}

// Já existe um emulador atachado à sessão? Evita abrir uma segunda janela quando a sessão já tem uma
// aberta — aí só focamos/selecionamos a window. `pgrep` é unix, usado só no modo tmux (também unix).
export async function sessionHasTerminalAttached(sessionName: string): Promise<boolean> {
	const proc = Bun.spawn(["pgrep", "-f", `tmux.*attach.*${sessionName}`], {
		stdout: "pipe",
		stderr: "ignore",
		stdin: "ignore",
	});
	const stdout = await new Response(proc.stdout).text();
	await proc.exited;

	return stdout.trim().length > 0;
}
