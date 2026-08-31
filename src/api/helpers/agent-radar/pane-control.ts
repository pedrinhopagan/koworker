import { spawnEnv } from "@/api/helpers/spawn";

// Enquanto alguém está com a visão Terminal de um pane na tela, o koworker vira o dono do PTY:
// um controller do stream cru do daemon (`kw-terminal terminal session control <paneId>`) nasce
// com o grid do frame do app, e o attach redimensiona o PTY do pane e trava o resize do layout
// (`direct_attach_resize_locks`). Fechando a visão, o controller cai, o daemon remove o lock e
// devolve o pane ao tamanho do layout. É o mesmo mecanismo de um emulador de verdade: o espelho
// para de adivinhar tamanho por corpo de letra e o grid passa a seguir o frame.

const RELEASE_GRACE_MS = 50;
const MAX_COLS = 500;
const MAX_ROWS = 500;

export type ControlProcess = {
	stdin: { write(text: string): unknown; flush?(): unknown };
	kill(): unknown;
	exited: Promise<number>;
};

type PaneControl = {
	proc: ControlProcess;
	cols: number;
	rows: number;
};

type SpawnImpl = (argv: string[]) => ControlProcess;

function defaultSpawn(argv: string[]): ControlProcess {
	return Bun.spawn(argv, {
		stdin: "pipe",
		stdout: "ignore",
		stderr: "ignore",
		env: spawnEnv(),
	}) as unknown as ControlProcess;
}

export class PaneTerminalControls {
	private readonly spawn: SpawnImpl;
	private readonly controls = new Map<string, PaneControl>();
	private readonly releaseTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private loggedFailure = false;

	constructor(deps: { spawn?: SpawnImpl } = {}) {
		this.spawn = deps.spawn ?? defaultSpawn;
	}

	resize(paneId: string, cols: number, rows: number): boolean {
		if (
			!Number.isInteger(cols) ||
			!Number.isInteger(rows) ||
			cols < 2 ||
			rows < 2 ||
			cols > MAX_COLS ||
			rows > MAX_ROWS
		) {
			return false;
		}

		const pendingRelease = this.releaseTimers.get(paneId);
		if (pendingRelease) {
			clearTimeout(pendingRelease);
			this.releaseTimers.delete(paneId);
		}

		const existing = this.controls.get(paneId);
		if (existing) {
			if (existing.cols === cols && existing.rows === rows) {
				return true;
			}

			if (this.send(existing, { type: "terminal.resize", cols, rows })) {
				existing.cols = cols;
				existing.rows = rows;
				return true;
			}

			this.drop(paneId, existing);
		}

		try {
			const proc = this.spawn([
				"kw-terminal",
				"terminal",
				"session",
				"control",
				paneId,
				"--cols",
				String(cols),
				"--rows",
				String(rows),
				"--takeover",
			]);
			const control: PaneControl = { proc, cols, rows };
			this.controls.set(paneId, control);
			void proc.exited.then(() => {
				if (this.controls.get(paneId) === control) {
					this.controls.delete(paneId);
				}
			});

			return true;
		} catch (error) {
			if (!this.loggedFailure) {
				this.loggedFailure = true;
				console.error("[Radar] Controller do terminal do pane falhou ao abrir:", error);
			}

			return false;
		}
	}

	// O grid que este controller pediu para o runtime. É a fonte de verdade do tamanho da tela
	// do pane enquanto a visão Terminal está aberta: o `pane.layout` continua reportando o
	// retângulo da TUI, que nada tem a ver com o PTY quando o koworker é o dono do resize.
	grid(paneId: string): { cols: number; rows: number } | null {
		const control = this.controls.get(paneId);
		if (!control) {
			return null;
		}

		return { cols: control.cols, rows: control.rows };
	}

	release(paneId: string): void {
		const control = this.controls.get(paneId);
		if (!control) {
			return;
		}

		this.controls.delete(paneId);
		this.send(control, { type: "terminal.release" });
		const timer = setTimeout(() => {
			this.releaseTimers.delete(paneId);
			control.proc.kill();
		}, RELEASE_GRACE_MS);
		timer.unref?.();
		this.releaseTimers.set(paneId, timer);
	}

	releaseAll(): void {
		for (const paneId of this.controls.keys()) {
			this.release(paneId);
		}
	}

	private send(control: PaneControl, command: object): boolean {
		try {
			control.proc.stdin.write(`${JSON.stringify(command)}\n`);
			control.proc.stdin.flush?.();
			return true;
		} catch {
			return false;
		}
	}

	private drop(paneId: string, control: PaneControl): void {
		if (this.controls.get(paneId) === control) {
			this.controls.delete(paneId);
		}

		control.proc.kill();
	}
}

export const paneTerminalControls = new PaneTerminalControls();
