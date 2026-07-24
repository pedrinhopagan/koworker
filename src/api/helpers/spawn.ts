// O serviço roda sob systemd --user, cujo PATH depende do ambiente importado no login e pode não
// conter os diretórios onde os CLIs dos agentes moram (`claude` em ~/.local/bin, `codex` em
// ~/.bun/bin). Garante os dois no PATH do filho pra execução não depender de como o serviço subiu.
export function spawnEnv(extra?: Record<string, string>): Record<string, string | undefined> {
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

function killProcessTree(proc: ReturnType<typeof Bun.spawn>) {
	if (process.platform !== "win32") {
		try {
			process.kill(-proc.pid);
			return;
		} catch {}
	}
	proc.kill();
}

// Um processo que já saiu pode deixar o pipe aberto: qualquer neto que herdou o descritor (um dev
// server, um watch que o agente subiu) segura a leitura para sempre. Depois da saída, a drenagem
// ganha um teto próprio e devolve o que já chegou, em vez de pendurar o run inteiro.
const STREAM_DRAIN_MS = 5_000;

function collectStream(stream: ReadableStream<Uint8Array> | undefined) {
	const chunks: Uint8Array[] = [];
	if (!stream) {
		return { drained: Promise.resolve(), text: () => "" };
	}

	const reader = stream.getReader();

	async function read() {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				return;
			}
			if (value) {
				chunks.push(value);
			}
		}
	}

	return {
		drained: read().catch(() => {}),
		text: () => new TextDecoder().decode(Buffer.concat(chunks)),
	};
}

// Roda um processo capturando stdout e stderr com teto de tempo: o timer mata o processo e sinaliza
// o estouro por `timedOut`. Neutro de propósito — o chamador decide como tratar (o autofill vira
// ORPCError; o runner de fluxo vira um evento de falha).
export async function spawnCapture(params: {
	cmd: string[];
	cwd: string;
	timeoutMs: number;
	env?: Record<string, string>;
	signal?: AbortSignal;
}): Promise<{
	stdout: string;
	stderr: string;
	exitCode: number;
	timedOut: boolean;
	cancelled: boolean;
}> {
	const env = spawnEnv(params.env);

	if (!Bun.which(params.cmd[0], { PATH: env.PATH })) {
		throw new Error(
			`O comando "${params.cmd[0]}" não foi encontrado no PATH do servidor — verifique a instalação do CLI no computador que executa o Kowork.`,
		);
	}

	const proc = Bun.spawn(params.cmd, {
		cwd: params.cwd,
		stdout: "pipe",
		stderr: "pipe",
		stdin: "ignore",
		env,
		detached: process.platform !== "win32",
	});

	let timedOut = false;
	let cancelled = false;
	const timer = setTimeout(() => {
		timedOut = true;
		killProcessTree(proc);
	}, params.timeoutMs);
	const handleAbort = () => {
		cancelled = true;
		killProcessTree(proc);
	};
	params.signal?.addEventListener("abort", handleAbort, { once: true });

	const stdout = collectStream(proc.stdout);
	const stderr = collectStream(proc.stderr);
	const exitCode = await proc.exited;
	await Promise.race([Promise.all([stdout.drained, stderr.drained]), Bun.sleep(STREAM_DRAIN_MS)]);
	clearTimeout(timer);
	params.signal?.removeEventListener("abort", handleAbort);

	return { stdout: stdout.text(), stderr: stderr.text(), exitCode, timedOut, cancelled };
}
