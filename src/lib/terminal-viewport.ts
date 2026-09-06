import { Terminal } from "@xterm/xterm";

import { TERMINAL_INPUT_MAX_LENGTH } from "@/api/schemas/terminal-workspace";

import { registerTerminalLinks } from "@/lib/link-navigation";
import { subscribeWithRetry } from "@/lib/realtime-subscription";
import { resolveTerminalTheme, TERMINAL_FONT_SIZE } from "@/lib/terminal-look";

type TerminalOptions = ConstructorParameters<typeof Terminal>[0];

export function mountTerminalViewport(input: {
	host: HTMLElement;
	cwd?: string;
	options: TerminalOptions;
	prepare?: (terminal: Terminal) => void;
	scroll?: (lines: number) => void;
}) {
	const terminal = new Terminal({ ...input.options, theme: resolveTerminalTheme(input.host) });
	input.prepare?.(terminal);
	terminal.open(input.host);
	terminal.textarea?.style.setProperty("font-size", `${TERMINAL_FONT_SIZE}px`);
	const links = registerTerminalLinks(terminal, input.cwd);
	const themeObserver = new MutationObserver(() => {
		terminal.options.theme = resolveTerminalTheme(input.host);
	});
	const themeRoot = input.host.closest("[data-theme-root]");
	if (themeRoot) {
		themeObserver.observe(themeRoot, { attributes: true, attributeFilter: ["class", "style"] });
	}
	const disposeTouch = attachTerminalTouchScroll(input.host, terminal, input.scroll);
	if (!window.matchMedia("(pointer: coarse)").matches) {
		terminal.focus();
	}

	return {
		terminal,
		dispose() {
			themeObserver.disconnect();
			disposeTouch();
			links.dispose();
			terminal.dispose();
		},
	};
}

export function attachTerminalTouchScroll(
	host: HTMLElement,
	terminal: Pick<Terminal, "rows" | "buffer" | "scrollLines">,
	scroll = (lines: number) => {
		if (terminal.buffer.active.type === "normal") {
			terminal.scrollLines(lines);
		}
	},
) {
	let startY = 0;
	let lastY = 0;
	let remainder = 0;
	let dragging = false;
	let active = false;
	let lastTime = 0;
	let velocity = 0;
	let frame = 0;

	function move(pixels: number) {
		const screen = host.querySelector<HTMLElement>(".xterm-screen");
		const lineHeight = (screen?.clientHeight || host.clientHeight) / terminal.rows;
		if (!lineHeight) {
			return;
		}
		remainder += pixels;
		const lines = Math.trunc(remainder / lineHeight);
		if (lines) {
			remainder -= lines * lineHeight;
			scroll(lines);
		}
	}

	function stop() {
		cancelAnimationFrame(frame);
		frame = 0;
		active = false;
	}

	function start(event: TouchEvent) {
		stop();
		dragging = false;
		if (event.touches.length !== 1) {
			return;
		}
		active = true;
		startY = lastY = event.touches[0].clientY;
		lastTime = performance.now();
		remainder = velocity = 0;
	}

	function drag(event: TouchEvent) {
		if (!active || event.touches.length !== 1) {
			stop();
			return;
		}
		const y = event.touches[0].clientY;
		if (!dragging && Math.abs(y - startY) < 8) {
			return;
		}
		dragging = true;
		event.preventDefault();
		event.stopPropagation();
		const now = performance.now();
		velocity = (lastY - y) / Math.max(1, now - lastTime);
		move(lastY - y);
		lastY = y;
		lastTime = now;
	}

	function end(event: TouchEvent) {
		if (!active || !dragging) {
			return;
		}
		active = false;
		event.preventDefault();
		if (performance.now() - lastTime > 80) {
			return;
		}
		lastTime = performance.now();
		function coast(now: number) {
			const elapsed = Math.min(now - lastTime, 32);
			lastTime = now;
			move(velocity * elapsed);
			velocity *= Math.exp(-elapsed / 160);
			if (Math.abs(velocity) > 0.02) {
				frame = requestAnimationFrame(coast);
			}
		}
		frame = requestAnimationFrame(coast);
	}

	function click(event: MouseEvent) {
		if (dragging) {
			event.preventDefault();
			event.stopPropagation();
			dragging = false;
		}
	}

	host.addEventListener("touchstart", start, { passive: true });
	host.addEventListener("touchmove", drag, { passive: false });
	host.addEventListener("touchend", end, { passive: false });
	host.addEventListener("touchcancel", stop);
	host.addEventListener("click", click, true);

	return () => {
		stop();
		host.removeEventListener("touchstart", start);
		host.removeEventListener("touchmove", drag);
		host.removeEventListener("touchend", end);
		host.removeEventListener("touchcancel", stop);
		host.removeEventListener("click", click, true);
	};
}

export function createTerminalInputQueue(input: {
	send: (data: string) => Promise<unknown>;
	onError: (error: unknown) => void;
}) {
	const queue: { data: string; done: () => void }[] = [];
	let sending = false;

	async function drain() {
		if (sending) {
			return;
		}
		sending = true;
		try {
			while (queue.length) {
				const first = queue.shift()!;
				const batch = [first];
				let data = first.data;
				while (
					queue.length &&
					!data.includes("\u001B") &&
					!queue[0].data.includes("\u001B") &&
					data.length + queue[0].data.length <= TERMINAL_INPUT_MAX_LENGTH
				) {
					const next = queue.shift()!;
					batch.push(next);
					data += next.data;
				}
				try {
					await input.send(data);
				} catch (error) {
					queue.splice(0).forEach((entry) => entry.done());
					input.onError(error);
				} finally {
					batch.forEach((entry) => entry.done());
				}
			}
		} finally {
			sending = false;
		}
	}

	return (data: string) => {
		if (data.length > TERMINAL_INPUT_MAX_LENGTH) {
			input.onError(
				new Error(
					`Envie até ${TERMINAL_INPUT_MAX_LENGTH} caracteres por vez; o texto não foi enviado.`,
				),
			);
			return Promise.resolve();
		}
		return new Promise<void>((done) => {
			queue.push({ data, done });
			void drain();
		});
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
	onConnectionChange?: (connected: boolean) => void;
}) {
	const controller = new AbortController();

	void subscribeWithRetry({ ...input, signal: controller.signal });

	return () => controller.abort();
}
