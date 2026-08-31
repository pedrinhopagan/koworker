import { describe, expect, test } from "bun:test";

import { PaneTerminalControls, type ControlProcess } from "./pane-control";

type FakeProcess = ControlProcess & {
	writes: string[];
	killed: boolean;
};

function fakeProcess(): FakeProcess {
	const proc = {
		writes: [] as string[],
		killed: false,
		stdin: {
			write(text: string) {
				proc.writes.push(text);
			},
			flush() {},
		},
		kill() {
			proc.killed = true;
		},
		exited: new Promise<number>(() => {}),
	};

	return proc;
}

function harness() {
	const spawned: FakeProcess[] = [];
	const controls = new PaneTerminalControls({
		spawn: (argv) => {
			const proc = fakeProcess();
			(proc as FakeProcess & { argv: string[] }).argv = argv;
			spawned.push(proc);
			return proc;
		},
	});

	return { controls, spawned };
}

function argvOf(proc: FakeProcess): string[] {
	return (proc as FakeProcess & { argv: string[] }).argv;
}

describe("PaneTerminalControls", () => {
	test("primeiro resize spawna o controller com o grid pedido", () => {
		const { controls, spawned } = harness();
		expect(controls.resize("w1:p1", 120, 40)).toBe(true);
		expect(spawned).toHaveLength(1);
		expect(argvOf(spawned[0]!)).toEqual([
			"kw-terminal",
			"terminal",
			"session",
			"control",
			"w1:p1",
			"--cols",
			"120",
			"--rows",
			"40",
			"--takeover",
		]);
	});

	test("resize seguinte reutiliza o controller e manda terminal.resize", () => {
		const { controls, spawned } = harness();
		controls.resize("w1:p1", 120, 40);
		controls.resize("w1:p1", 100, 30);
		expect(spawned).toHaveLength(1);
		expect(JSON.parse(spawned[0]!.writes[0]!)).toEqual({
			type: "terminal.resize",
			cols: 100,
			rows: 30,
		});
	});

	test("resize idêntico não escreve nada", () => {
		const { controls, spawned } = harness();
		controls.resize("w1:p1", 120, 40);
		controls.resize("w1:p1", 120, 40);
		expect(spawned[0]!.writes).toHaveLength(0);
	});

	test("grid devolve o pedido vivo e null após release", () => {
		const { controls } = harness();
		expect(controls.grid("w1:p1")).toBeNull();
		controls.resize("w1:p1", 120, 40);
		expect(controls.grid("w1:p1")).toEqual({ cols: 120, rows: 40 });
		controls.resize("w1:p1", 100, 30);
		expect(controls.grid("w1:p1")).toEqual({ cols: 100, rows: 30 });
		controls.release("w1:p1");
		expect(controls.grid("w1:p1")).toBeNull();
	});

	test("stdin morto derruba o controller velho e spawna outro com o grid novo", () => {
		const { controls, spawned } = harness();
		controls.resize("w1:p1", 120, 40);
		spawned[0]!.stdin.write = () => {
			throw new Error("EPIPE");
		};
		controls.resize("w1:p1", 90, 25);
		expect(spawned[0]!.killed).toBe(true);
		expect(spawned).toHaveLength(2);
		expect(argvOf(spawned[1]!)).toContain("--cols");
		expect(argvOf(spawned[1]!)).toContain("90");
	});

	test("release manda terminal.release, mata o processo e libera um resize novo", async () => {
		const { controls, spawned } = harness();
		controls.resize("w1:p1", 120, 40);
		controls.release("w1:p1");
		expect(JSON.parse(spawned[0]!.writes[0]!)).toEqual({ type: "terminal.release" });

		await Bun.sleep(80);
		expect(spawned[0]!.killed).toBe(true);

		controls.resize("w1:p1", 80, 24);
		expect(spawned).toHaveLength(2);
	});

	test("release sem controller é no-op", () => {
		const { controls, spawned } = harness();
		controls.release("w1:p1");
		expect(spawned).toHaveLength(0);
	});

	test("grid inválido é recusado sem spawnar", () => {
		const { controls, spawned } = harness();
		expect(controls.resize("w1:p1", 1, 24)).toBe(false);
		expect(controls.resize("w1:p1", 501, 24)).toBe(false);
		expect(controls.resize("w1:p1", Number.NaN, 24)).toBe(false);
		expect(spawned).toHaveLength(0);
	});

	test("controllers de panes diferentes são independentes", async () => {
		const { controls, spawned } = harness();
		controls.resize("w1:p1", 120, 40);
		controls.resize("w1:p2", 80, 24);
		expect(spawned).toHaveLength(2);
		controls.release("w1:p1");

		await Bun.sleep(80);
		expect(spawned[0]!.killed).toBe(true);
		expect(spawned[1]!.killed).toBe(false);
	});
});
