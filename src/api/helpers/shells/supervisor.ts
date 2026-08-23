import { Terminal as Screen } from "@xterm/headless";

import { PubSub, type ShellStreamEvent } from "../../pubsub";
import { ScrollbackRing } from "./scrollback-ring";

const SCROLLBACK_BYTES = 1_000_000;
const SCREEN_SCROLLBACK_LINES = 10_000;
const FLUSH_MS = 8;

const SHELL = process.env.SHELL ?? "/bin/bash";

type Shell = {
	id: string;
	label: string;
	cwd: string;
	projectId: string | null;
	cols: number;
	rows: number;
	createdAt: number;
	pty: Bun.Terminal;
	pid: number;
	screen: Screen;
	ring: ScrollbackRing;
	title: string | null;
	exited: boolean;
	exitCode: number | null;
	pending: Buffer[];
	flushTimer: ReturnType<typeof setTimeout> | null;
};

export type ShellRecord = {
	id: string;
	label: string;
	cwd: string;
	projectId: string | null;
	cols: number;
	rows: number;
	createdAt: number;
	title: string | null;
	status: "live" | "exited";
	exitCode: number | null;
};

type OpenOptions = {
	cwd: string;
	cols: number;
	rows: number;
	label?: string;
	projectId?: string | null;
	/** Executável do shell; por padrão é o login shell do usuário. */
	shellPath?: string;
	shellArgs?: string[];
};

function publish(id: string, event: ShellStreamEvent): void {
	PubSub.publish("shells", id, event).catch(() => {});
}

export class ShellSupervisor {
	private readonly shells = new Map<string, Shell>();
	private seq = 0;

	open({ cwd, cols, rows, label, projectId, shellPath, shellArgs }: OpenOptions): ShellRecord {
		const id = `shell-${++this.seq}`;
		const ring = new ScrollbackRing(SCROLLBACK_BYTES);
		// O motor vt100 é a fonte de verdade do lado do servidor: responde às consultas de
		// capability (DA, kitty keyboard, OSC de cor) que shells e TUIs mandam ao arrancar —
		// sem essas respostas o programa do outro lado fica preso esperando. É o que deixa um
		// TUI subir num shell que ninguém abriu na tela ainda.
		const screen = new Screen({
			cols,
			rows,
			scrollback: SCREEN_SCROLLBACK_LINES,
			allowProposedApi: true,
		});

		let shell!: Shell;

		const pty = new Bun.Terminal({
			cols,
			rows,
			name: "xterm-256color",
			data: (_pty, bytes) => {
				const chunk = Buffer.from(bytes);
				ring.append(chunk);
				screen.write(chunk);
				this.queueData(shell, chunk);
			},
			exit: (_pty, code) => {
				if (shell.exited) {
					return;
				}

				shell.exited = true;
				shell.exitCode = code;
				this.flushPending(shell);
				publish(id, { type: "exit", exitCode: code });
			},
		});

		// As respostas do motor às consultas são o input do terminal: voltam pro PTY ou o
		// programa bloqueia esperando uma resposta que nunca chega.
		screen.onData((data) => {
			if (!shell.exited) {
				pty.write(data);
			}
		});
		screen.onTitleChange((title) => {
			const trimmed = title.trim();
			if (!trimmed || trimmed === shell.title) {
				return;
			}

			shell.title = trimmed;
			publish(id, { type: "title", title: trimmed });
		});

		// `setsid -c` faz do shell um líder de sessão com o PTY como terminal de controle —
		// sem isso o job control falha e shells rigorosos como fish nem começam.
		const proc = Bun.spawn(["setsid", "-c", shellPath ?? SHELL, ...(shellArgs ?? [])], {
			terminal: pty,
			cwd,
			env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" },
		});

		// O callback `exit` do Bun.Terminal não é confiável com setsid: o processo morre e o
		// evento fica devendo. O desfecho do subprocess resolve sempre, então ele é quem
		// garante o fim; os bytes finais ainda fluem porque a publicação não olha `exited`.
		void proc.exited.then((code) => {
			if (shell.exited) {
				return;
			}

			shell.exited = true;
			shell.exitCode = code;
			this.flushPending(shell);
			publish(id, { type: "exit", exitCode: code });
		});

		shell = {
			id,
			label: label?.trim() || `Shell ${this.seq}`,
			cwd,
			projectId: projectId ?? null,
			cols,
			rows,
			createdAt: Date.now(),
			pty,
			pid: proc.pid,
			screen,
			ring,
			title: null,
			exited: false,
			exitCode: null,
			pending: [],
			flushTimer: null,
		};
		this.shells.set(id, shell);

		return this.record(shell);
	}

	write(id: string, data: string): boolean {
		const shell = this.shells.get(id);
		if (!shell || shell.exited) {
			return false;
		}

		shell.pty.write(data);
		return true;
	}

	resize(id: string, cols: number, rows: number): boolean {
		const shell = this.shells.get(id);
		if (!shell || shell.exited) {
			return false;
		}

		if (
			!Number.isInteger(cols) ||
			!Number.isInteger(rows) ||
			cols < 2 ||
			rows < 2 ||
			cols > 500 ||
			rows > 500
		) {
			return false;
		}

		shell.cols = cols;
		shell.rows = rows;
		shell.pty.resize(cols, rows);
		shell.screen.resize(cols, rows);
		return true;
	}

	// Idempotente por design: o shell pode ter morrido sozinho (exit callback) no mesmo
	// instante em que o usuário pediu o fechamento; quem rodar segundo não faz nada.
	close(id: string): boolean {
		const shell = this.shells.get(id);
		if (!shell) {
			return false;
		}

		this.flushPending(shell);
		if (!shell.exited) {
			shell.exited = true;
			try {
				process.kill(-shell.pid, "SIGHUP");
			} catch {
				shell.pty.close();
			}
		}

		shell.pty.close();
		shell.screen.dispose();
		this.shells.delete(id);
		publish(id, { type: "closed" });
		return true;
	}

	get(id: string): ShellRecord | null {
		const shell = this.shells.get(id);
		return shell ? this.record(shell) : null;
	}

	rename(id: string, label: string): ShellRecord | null {
		const shell = this.shells.get(id);
		if (!shell) {
			return null;
		}

		const trimmed = label.trim();
		if (trimmed) {
			shell.label = trimmed;
			return this.record(shell);
		}

		return null;
	}

	replayBase64(id: string): string | null {
		const shell = this.shells.get(id);
		return shell ? shell.ring.readBase64() : null;
	}

	list(): ShellRecord[] {
		return [...this.shells.values()]
			.sort((a, b) => b.createdAt - a.createdAt)
			.map((shell) => this.record(shell));
	}

	private record(shell: Shell): ShellRecord {
		return {
			id: shell.id,
			label: shell.label,
			cwd: shell.cwd,
			projectId: shell.projectId,
			cols: shell.cols,
			rows: shell.rows,
			createdAt: shell.createdAt,
			title: shell.title,
			status: shell.exited ? "exited" : "live",
			exitCode: shell.exitCode,
		};
	}

	// Coalescência de saída: rajada de output vira um único evento por janela de 8ms —
	// imperceptível no eco do teclado, decisivo num `cat` de arquivo grande.
	private queueData(shell: Shell, chunk: Buffer): void {
		shell.pending.push(chunk);
		if (shell.flushTimer) {
			return;
		}

		shell.flushTimer = setTimeout(() => {
			shell.flushTimer = null;
			this.flushPending(shell);
		}, FLUSH_MS);
		shell.flushTimer.unref?.();
	}

	private flushPending(shell: Shell): void {
		if (shell.flushTimer) {
			clearTimeout(shell.flushTimer);
			shell.flushTimer = null;
		}

		if (shell.pending.length === 0) {
			return;
		}

		const merged = Buffer.concat(shell.pending);
		shell.pending = [];
		publish(shell.id, { type: "data", b64: merged.toString("base64") });
	}
}

export const shellSupervisor = new ShellSupervisor();
