import { spawnEnv } from "./spawn";

// Integração com o kw-diff, o revisor de diff desta máquina. Ele é um servidor local (`kw-diff`) com
// uma janela GTK (`kw-diff-window`) coordenados pelo launcher `kw-diff-open`, e a revisão é escolhida
// pela querystring (`?cwd=<repo>`). Aqui só apontamos a janela: nada do estado do kw-diff é espelhado.

const KW_DIFF_PORT = process.env.KW_DIFF_PORT ?? "4816";
const KW_DIFF_URL = `http://127.0.0.1:${KW_DIFF_PORT}`;

function windowPidFile(): string {
	const state =
		process.env.KW_DIFF_STATE_DIR ??
		`${process.env.XDG_STATE_HOME ?? `${process.env.HOME}/.local/state`}/kw-diff`;

	return `${state}/window.pid`;
}

async function kwDiffServerRunning(): Promise<boolean> {
	try {
		const response = await fetch(`${KW_DIFF_URL}/api/health`, {
			signal: AbortSignal.timeout(1_000),
		});

		return response.ok;
	} catch {
		return false;
	}
}

// O launcher é quem decide reusar ou reiniciar o servidor e a janela, então ele é o caminho de
// abertura; erro dele (GTK ausente, porta ocupada por outro binário) volta em stderr.
async function runKwDiffOpen(): Promise<void> {
	const proc = Bun.spawn(["kw-diff-open", "--show"], {
		stdout: "ignore",
		stderr: "pipe",
		stdin: "ignore",
		env: spawnEnv(),
	});
	const stderr = await new Response(proc.stderr).text();

	if ((await proc.exited) !== 0) {
		throw new Error(`Falha ao abrir o kw-diff: ${stderr.trim() || "erro"}`);
	}
}

export async function openKwDiff(cwd: string): Promise<void> {
	if (!(await kwDiffServerRunning())) {
		await runKwDiffOpen();

		for (let attempt = 0; attempt < 25; attempt++) {
			await Bun.sleep(200);
			if (await kwDiffServerRunning()) {
				break;
			}
		}

		if (!(await kwDiffServerRunning())) {
			throw new Error("kw-diff não respondeu — execute `kw-diff-open` manualmente e tente de novo");
		}
	}

	// A navegação não é aguardada: a janela é uma instância única GTK, então este processo ou entrega o
	// URL para a janela aberta e sai, ou vira ele mesmo a janela e fica de pé até o usuário fechá-la.
	Bun.spawn(["kw-diff-window", "--show", `${KW_DIFF_URL}/?cwd=${encodeURIComponent(cwd)}`], {
		stdout: "ignore",
		stderr: "ignore",
		stdin: "ignore",
		env: spawnEnv({ KW_DIFF_WINDOW_PID_FILE: windowPidFile() }),
	}).unref();
}
