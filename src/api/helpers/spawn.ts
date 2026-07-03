// Roda um processo capturando stdout com teto de tempo: o timer mata o processo e sinaliza o
// estouro por `timedOut`. Neutro de propósito — o chamador decide como tratar (o autofill vira
// ORPCError; o runner de fluxo vira um evento de falha). Padrão de `terminal/tmux.ts`: stdout em
// pipe lido por `new Response(proc.stdout).text()`, sincronizado com `proc.exited`.
export async function spawnCapture(params: {
	cmd: string[];
	cwd: string;
	timeoutMs: number;
}): Promise<{ stdout: string; exitCode: number; timedOut: boolean }> {
	const proc = Bun.spawn(params.cmd, {
		cwd: params.cwd,
		stdout: "pipe",
		stderr: "ignore",
		stdin: "ignore",
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
