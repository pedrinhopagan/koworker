import { expect, test } from "bun:test";
import { Terminal as Screen } from "@xterm/headless";

import type { ShellStreamEvent } from "@/api/pubsub";
import { ShellRuntime } from "./supervisor";

test("runtime esconde PTY, replay, metadata, publicação e cleanup atrás de três operações", async () => {
	let terminalOptions: ConstructorParameters<typeof Bun.Terminal>[0] | null = null;
	let disposed = false;
	const writes: string[] = [];
	const stream: ShellStreamEvent[] = [];
	let catalogChanges = 0;
	let finishProcess!: (code: number) => void;
	const terminal = {
		write(data: string) {
			writes.push(data);
		},
		resize() {},
		close() {},
	} as unknown as Bun.Terminal;
	const screen = {
		write() {},
		resize() {},
		dispose() {
			disposed = true;
		},
		onData() {},
		onTitleChange() {},
	} as unknown as Screen;
	const runtime = new ShellRuntime({
		dependencies: {
			now: () => 10_000,
			publishStream: (_id, event) => stream.push(event),
			publishCatalog: () => {
				catalogChanges += 1;
			},
			scanAgent: () => Promise.resolve(null),
			createScreen: () => screen,
			createTerminal: (options) => {
				terminalOptions = options;

				return terminal;
			},
			spawnProcess: () => ({
				pid: 123,
				exited: new Promise<number>((resolve) => {
					finishProcess = resolve;
				}),
			}),
		},
	});

	const opened = runtime.execute({
		type: "open",
		cwd: "/tmp",
		cols: 80,
		rows: 24,
	});
	runtime.execute({ type: "input", id: opened.id, data: "echo oi\r" });

	expect(writes).toEqual(["echo oi\r"]);
	expect(runtime.snapshot(opened.id)?.status).toBe("live");
	expect(catalogChanges).toBe(1);

	const options = terminalOptions as unknown as {
		data: (terminal: Bun.Terminal, bytes: Uint8Array) => void;
	};
	options.data(terminal, Buffer.from("saida"));
	await Bun.sleep(20);

	expect(Buffer.from(runtime.attach(opened.id)?.replayBase64 ?? "", "base64").toString()).toBe(
		"saida",
	);
	expect(stream).toEqual([{ type: "data", b64: Buffer.from("saida").toString("base64") }]);

	finishProcess(0);
	await Bun.sleep(0);
	expect(runtime.snapshot(opened.id)?.status).toBe("exited");
	expect(stream.at(-1)).toEqual({ type: "exit", exitCode: 0 });

	expect(runtime.execute({ type: "close", id: opened.id })).toBe(true);
	expect(runtime.snapshot(opened.id)).toBeNull();
	expect(disposed).toBe(true);
});
