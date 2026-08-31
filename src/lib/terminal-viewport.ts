import { Terminal } from "@xterm/xterm";

import { registerTerminalLinks } from "@/lib/link-navigation";
import { subscribeWithRetry } from "@/lib/realtime-subscription";

type TerminalOptions = ConstructorParameters<typeof Terminal>[0];

export function mountTerminalViewport(input: {
	host: HTMLElement;
	cwd?: string;
	options: TerminalOptions;
	prepare?: (terminal: Terminal) => void;
}) {
	const terminal = new Terminal(input.options);
	input.prepare?.(terminal);
	terminal.open(input.host);
	const links = registerTerminalLinks(terminal, input.cwd);
	terminal.focus();

	return {
		terminal,
		dispose() {
			links.dispose();
			terminal.dispose();
		},
	};
}

export function createTerminalLayoutScheduler(layout: () => void) {
	let frame = 0;

	return {
		request() {
			if (frame) {
				return;
			}

			frame = requestAnimationFrame(() => {
				frame = 0;
				layout();
			});
		},
		dispose() {
			if (frame) {
				cancelAnimationFrame(frame);
				frame = 0;
			}
		},
	};
}

export function createTerminalResizeGate(requestLayout: () => void) {
	let paused = false;
	let pending = false;

	return {
		request() {
			if (paused) {
				pending = true;
				return;
			}

			requestLayout();
		},
		setPaused(next: boolean) {
			paused = next;
			if (!paused && pending) {
				pending = false;
				requestLayout();
			}
		},
	};
}

export function connectTerminalViewport<T>(input: {
	label: string;
	subscribe: (signal: AbortSignal) => Promise<AsyncIterable<T>>;
	onEvent: (event: T) => void;
	onReconnect?: () => void;
}) {
	const controller = new AbortController();

	void subscribeWithRetry({ ...input, signal: controller.signal });

	return () => controller.abort();
}
