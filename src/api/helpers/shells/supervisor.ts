import { Terminal as Screen } from "@xterm/headless";

import { PubSub, type ShellStreamEvent } from "../../pubsub";
import {
	TERMINAL_GRID_LIMITS,
	type ShellAgentStatus,
	type ShellRecord,
} from "../../schemas/terminal-workspace";
import { publishTerminalWorkspaceChange } from "../terminal-workspace-events";
import { detectShellAgent } from "./agent-detect";
import { ScrollbackRing } from "./scrollback-ring";

const SCROLLBACK_BYTES = 1_000_000;
const SCREEN_SCROLLBACK_LINES = 10_000;
const FLUSH_MS = 8;
const AGENT_SWEEP_MS = 3_000;
const AGENT_ACTIVE_MS = 12_000;
const INPUT_ECHO_MS = 400;

const SHELL = process.env.SHELL ?? "/bin/bash";

// O daemon do kw-terminal não enxerga estes PTYs, então o status é mais grosso que o do radar:
// um TUI trabalhando redesenha quadro sem parar (spinner, tool calls) e parado no prompt fica
// quieta — saída recente, descontado o eco do teclado, é o sinal de trabalho.
export function shellAgentStatus(input: { agentActiveAt: number; now: number }): ShellAgentStatus {
	return input.now - input.agentActiveAt <= AGENT_ACTIVE_MS ? "working" : "idle";
}

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
	agent: string | null;
	agentActiveAt: number;
	publishedAgentStatus: ShellAgentStatus | null;
	lastInputAt: number;
	pending: Buffer[];
	flushTimer: ReturnType<typeof setTimeout> | null;
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

type ShellRuntimeCommand =
	| ({ type: "open" } & OpenOptions)
	| { type: "input"; id: string; data: string }
	| { type: "resize"; id: string; cols: number; rows: number }
	| { type: "rename"; id: string; label: string }
	| { type: "close"; id: string };

type RuntimeProcess = { pid: number; exited: Promise<number> };
type ScreenOptions = ConstructorParameters<typeof Screen>[0];
type TerminalOptions = ConstructorParameters<typeof Bun.Terminal>[0];

type ShellRuntimeDependencies = {
	now: () => number;
	publishStream: (id: string, event: ShellStreamEvent) => void;
	publishCatalog: () => void;
	scanAgent: (pid: number, procRoot: string) => Promise<string | null>;
	createScreen: (options: ScreenOptions) => Screen;
	createTerminal: (options: TerminalOptions) => Bun.Terminal;
	spawnProcess: (input: {
		terminal: Bun.Terminal;
		cwd: string;
		shellPath: string;
		shellArgs: string[];
	}) => RuntimeProcess;
};

function publishStream(id: string, event: ShellStreamEvent): void {
	PubSub.publish("shells", id, event).catch(() => {});
	if (event.type !== "data") {
		publishTerminalWorkspaceChange("shell").catch(() => {});
	}
}

function publishCatalog() {
	publishTerminalWorkspaceChange("shell").catch(() => {});
}

const DEFAULT_DEPENDENCIES: ShellRuntimeDependencies = {
	now: () => Date.now(),
	publishStream,
	publishCatalog,
	scanAgent: detectShellAgent,
	createScreen: (options) => new Screen(options),
	createTerminal: (options) => new Bun.Terminal(options),
	spawnProcess: ({ terminal, cwd, shellPath, shellArgs }) =>
		Bun.spawn(["setsid", "-c", shellPath, ...shellArgs], {
			terminal,
			cwd,
			env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" },
		}),
};

export class ShellRuntime {
	private readonly shells = new Map<string, Shell>();
	private readonly agentSweepMs: number;
	private readonly procRoot: string;
	private readonly dependencies: ShellRuntimeDependencies;
	private agentTimer: ReturnType<typeof setInterval> | null = null;
	private sweeping = false;
	private seq = 0;

	constructor(
		options: {
			agentSweepMs?: number;
			procRoot?: string;
			dependencies?: Partial<ShellRuntimeDependencies>;
		} = {},
	) {
		this.agentSweepMs = options.agentSweepMs ?? AGENT_SWEEP_MS;
		this.procRoot = options.procRoot ?? "/proc";
		this.dependencies = { ...DEFAULT_DEPENDENCIES, ...options.dependencies };
	}

	execute(command: { type: "open" } & OpenOptions): ShellRecord;
	execute(command: { type: "rename"; id: string; label: string }): ShellRecord | null;
	execute(command: Exclude<ShellRuntimeCommand, { type: "open" } | { type: "rename" }>): boolean;
	execute(command: ShellRuntimeCommand): ShellRecord | boolean | null {
		switch (command.type) {
			case "open":
				return this.open(command);
			case "input":
				return this.write(command.id, command.data);
			case "resize":
				return this.resize(command.id, command.cols, command.rows);
			case "rename":
				return this.rename(command.id, command.label);
			case "close":
				return this.close(command.id);
		}
	}

	snapshot(): ShellRecord[];
	snapshot(id: string): ShellRecord | null;
	snapshot(id?: string) {
		if (id) {
			const shell = this.shells.get(id);

			return shell ? this.record(shell) : null;
		}

		return [...this.shells.values()]
			.sort((left, right) => right.createdAt - left.createdAt)
			.map((shell) => this.record(shell));
	}

	attach(id: string) {
		const shell = this.shells.get(id);

		return shell ? { replayBase64: shell.ring.readBase64() } : null;
	}

	private open({
		cwd,
		cols,
		rows,
		label,
		projectId,
		shellPath,
		shellArgs,
	}: OpenOptions): ShellRecord {
		const id = `shell-${++this.seq}`;
		const ring = new ScrollbackRing(SCROLLBACK_BYTES);
		// O motor vt100 é a fonte de verdade do lado do servidor: responde às consultas de
		// capability (DA, kitty keyboard, OSC de cor) que shells e TUIs mandam ao arrancar —
		// sem essas respostas o programa do outro lado fica preso esperando. É o que deixa um
		// TUI subir num shell que ninguém abriu na tela ainda.
		const screen = this.dependencies.createScreen({
			cols,
			rows,
			scrollback: SCREEN_SCROLLBACK_LINES,
			allowProposedApi: true,
		});

		let shell!: Shell;

		const pty = this.dependencies.createTerminal({
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
				this.maybeStopAgentSweep();
				this.dependencies.publishStream(id, { type: "exit", exitCode: code });
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
			this.dependencies.publishStream(id, { type: "title", title: trimmed });
		});

		// `setsid -c` faz do shell um líder de sessão com o PTY como terminal de controle —
		// sem isso o job control falha e shells rigorosos como fish nem começam.
		const proc = this.dependencies.spawnProcess({
			terminal: pty,
			cwd,
			shellPath: shellPath ?? SHELL,
			shellArgs: shellArgs ?? [],
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
			this.maybeStopAgentSweep();
			this.dependencies.publishStream(id, { type: "exit", exitCode: code });
		});

		shell = {
			id,
			label: label?.trim() || `Shell ${this.seq}`,
			cwd,
			projectId: projectId ?? null,
			cols,
			rows,
			createdAt: this.dependencies.now(),
			pty,
			pid: proc.pid,
			screen,
			ring,
			title: null,
			exited: false,
			exitCode: null,
			agent: null,
			agentActiveAt: 0,
			publishedAgentStatus: null,
			lastInputAt: 0,
			pending: [],
			flushTimer: null,
		};
		this.shells.set(id, shell);
		this.ensureAgentSweep();
		this.dependencies.publishCatalog();

		return this.record(shell);
	}

	private write(id: string, data: string): boolean {
		const shell = this.shells.get(id);
		if (!shell || shell.exited) {
			return false;
		}

		shell.lastInputAt = this.dependencies.now();
		shell.pty.write(data);
		return true;
	}

	private resize(id: string, cols: number, rows: number): boolean {
		const shell = this.shells.get(id);
		if (!shell || shell.exited) {
			return false;
		}

		if (
			!Number.isInteger(cols) ||
			!Number.isInteger(rows) ||
			cols < TERMINAL_GRID_LIMITS.minCols ||
			rows < TERMINAL_GRID_LIMITS.minRows ||
			cols > TERMINAL_GRID_LIMITS.maxCols ||
			rows > TERMINAL_GRID_LIMITS.maxRows
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
	private close(id: string): boolean {
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
		this.maybeStopAgentSweep();
		this.dependencies.publishStream(id, { type: "closed" });
		return true;
	}

	private rename(id: string, label: string): ShellRecord | null {
		const shell = this.shells.get(id);
		if (!shell) {
			return null;
		}

		const trimmed = label.trim();
		if (trimmed) {
			shell.label = trimmed;
			this.dependencies.publishCatalog();
			return this.record(shell);
		}

		return null;
	}

	private record(shell: Shell): ShellRecord {
		const agent = shell.exited ? null : shell.agent;

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
			pid: shell.pid,
			agent,
			agentStatus: agent
				? shellAgentStatus({ agentActiveAt: shell.agentActiveAt, now: this.dependencies.now() })
				: null,
		};
	}

	// Detecção periódica de agent CLI: a árvore de processos de cada shell vivo é relida e o slug
	// reconhecido vira identidade do item na sidebar. O TUI sair (voltar ao prompt) reverte o item
	// a shell no sweep seguinte.
	private ensureAgentSweep(): void {
		if (this.agentTimer) {
			return;
		}

		this.agentTimer = setInterval(() => {
			void this.sweepAgents();
		}, this.agentSweepMs);
		this.agentTimer.unref?.();
	}

	private maybeStopAgentSweep(): void {
		if (!this.agentTimer) {
			return;
		}

		const hasLiveShell = [...this.shells.values()].some((shell) => !shell.exited);
		if (hasLiveShell) {
			return;
		}

		clearInterval(this.agentTimer);
		this.agentTimer = null;
	}

	private async sweepAgents(): Promise<void> {
		if (this.sweeping) {
			return;
		}

		this.sweeping = true;
		try {
			for (const shell of this.shells.values()) {
				if (shell.exited) {
					shell.agent = null;
					shell.publishedAgentStatus = null;
					continue;
				}

				const previousAgent = shell.agent;
				const previousStatus = shell.publishedAgentStatus;
				shell.agent = await this.dependencies.scanAgent(shell.pid, this.procRoot);
				shell.publishedAgentStatus = shell.agent
					? shellAgentStatus({ agentActiveAt: shell.agentActiveAt, now: this.dependencies.now() })
					: null;

				if (previousAgent !== shell.agent || previousStatus !== shell.publishedAgentStatus) {
					this.dependencies.publishCatalog();
				}
			}
		} finally {
			this.sweeping = false;
		}

		this.maybeStopAgentSweep();
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
		// Eco de teclado não é trabalho do agent: saída chegando colada no input do usuário não conta
		// como atividade, senão digitar no prompt do TUI acendia "Trabalhando".
		if (this.dependencies.now() - shell.lastInputAt >= INPUT_ECHO_MS) {
			shell.agentActiveAt = this.dependencies.now();
			if (shell.agent && shell.publishedAgentStatus !== "working") {
				shell.publishedAgentStatus = "working";
				this.dependencies.publishCatalog();
			}
		}
		this.dependencies.publishStream(shell.id, {
			type: "data",
			b64: merged.toString("base64"),
		});
	}
}

export const shellRuntime = new ShellRuntime();
