import { expect, test } from "bun:test";

import { createTerminalLayoutScheduler, createTerminalResizeGate } from "./terminal-viewport";

test("agrupa pedidos de layout em uma execução por frame e cancela o pendente", () => {
	const originalRequest = globalThis.requestAnimationFrame;
	const originalCancel = globalThis.cancelAnimationFrame;
	const callbacks: FrameRequestCallback[] = [];
	let requested = 0;
	let cancelled = 0;
	let layouts = 0;

	globalThis.requestAnimationFrame = (next) => {
		requested += 1;
		callbacks.push(next);

		return requested;
	};
	globalThis.cancelAnimationFrame = () => {
		cancelled += 1;
	};

	try {
		const scheduler = createTerminalLayoutScheduler(() => {
			layouts += 1;
		});

		scheduler.request();
		scheduler.request();
		expect(requested).toBe(1);
		callbacks[0]?.(0);
		expect(layouts).toBe(1);

		scheduler.request();
		scheduler.dispose();
		expect(cancelled).toBe(1);
	} finally {
		globalThis.requestAnimationFrame = originalRequest;
		globalThis.cancelAnimationFrame = originalCancel;
	}
});

test("adiar resize durante arrasto reduz uma rajada a um layout final", () => {
	let layouts = 0;
	const gate = createTerminalResizeGate(() => {
		layouts += 1;
	});

	gate.setPaused(true);
	for (let index = 0; index < 50; index++) {
		gate.request();
	}
	expect(layouts).toBe(0);

	gate.setPaused(false);
	expect(layouts).toBe(1);
	gate.setPaused(false);
	expect(layouts).toBe(1);
});
