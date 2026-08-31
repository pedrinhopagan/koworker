import { existsSync, readdirSync } from "node:fs";

// O backend pode ter sido lançado sem env de display (systemd, gateway, SSH). Sem WAYLAND_DISPLAY e
// DISPLAY, qualquer app gráfico que ele spawna (gio open → browser, gerenciador de arquivos) morre
// em silêncio — o launcher sai 0 e o filho aborta com "no DISPLAY". Reconstruímos o apontamento a
// partir do socket real da sessão.
export function displayFallback(env: Record<string, string | undefined>): Record<string, string> {
	if (process.platform !== "linux" || env.WAYLAND_DISPLAY || env.DISPLAY) {
		return {};
	}

	const found: Record<string, string> = {};
	const runtimeDir = env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.() ?? ""}`;
	const entries = (() => {
		try {
			return readdirSync(runtimeDir);
		} catch {
			return [];
		}
	})();
	const wayland = entries.find((name) => /^wayland-\d+$/.test(name));
	if (wayland) {
		found.WAYLAND_DISPLAY = wayland;
	}
	if (existsSync("/tmp/.X11-unix/X0")) {
		found.DISPLAY = ":0";
	}

	return found;
}

export function spawnEnv(extra?: Record<string, string>): Record<string, string | undefined> {
	const display = displayFallback(process.env);
	const parts = (process.env.PATH ?? "").split(":").filter(Boolean);
	const home = process.env.HOME;
	if (home) {
		const userBins = [`${home}/.local/bin`, `${home}/.bun/bin`];
		const withoutUserBins = parts.filter((dir) => !userBins.includes(dir));

		return {
			...process.env,
			...display,
			...extra,
			PATH: [...userBins, ...withoutUserBins].join(":"),
		};
	}

	return { ...process.env, ...display, ...extra, PATH: parts.join(":") };
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

export const STREAM_TAIL_MAX_BYTES = 1_000_000;

export const STREAM_TRUNCATION_NOTICE = "… (início truncado)\n";

export function collectStream(
	stream: ReadableStream<Uint8Array> | undefined,
	onChunk?: (text: string) => void,
) {
	if (!stream) {
		return { drained: Promise.resolve(), text: () => "" };
	}

	const chunks: Uint8Array[] = [];
	const reader = stream.getReader();
	const liveDecoder = new TextDecoder();
	let bufferedBytes = 0;
	let truncated = false;

	function keepTail(value: Uint8Array) {
		chunks.push(value);
		bufferedBytes += value.byteLength;

		while (bufferedBytes > STREAM_TAIL_MAX_BYTES && chunks.length > 1) {
			bufferedBytes -= chunks.shift()?.byteLength ?? 0;
			truncated = true;
		}

		const [only] = chunks;
		if (only && bufferedBytes > STREAM_TAIL_MAX_BYTES) {
			chunks[0] = only.subarray(only.byteLength - STREAM_TAIL_MAX_BYTES);
			bufferedBytes = STREAM_TAIL_MAX_BYTES;
			truncated = true;
		}
	}

	async function read() {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				return;
			}
			if (!value) {
				continue;
			}

			keepTail(value);
			onChunk?.(liveDecoder.decode(value, { stream: true }));
		}
	}

	return {
		drained: read().catch(() => {}),
		text: () => {
			const text = new TextDecoder().decode(Buffer.concat(chunks));

			return truncated ? `${STREAM_TRUNCATION_NOTICE}${text}` : text;
		},
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
	onStdout?: (text: string) => void;
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

	const stdout = collectStream(proc.stdout, params.onStdout);
	const stderr = collectStream(proc.stderr);
	const exitCode = await proc.exited;
	await Promise.race([Promise.all([stdout.drained, stderr.drained]), Bun.sleep(STREAM_DRAIN_MS)]);
	clearTimeout(timer);
	params.signal?.removeEventListener("abort", handleAbort);

	return { stdout: stdout.text(), stderr: stderr.text(), exitCode, timedOut, cancelled };
}
