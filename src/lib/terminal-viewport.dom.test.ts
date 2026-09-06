import { expect, test } from "bun:test";

import { attachTerminalTouchScroll } from "./terminal-viewport";
import { resolveTerminalTheme } from "./terminal-look";

test("tema do terminal resolve cores do host em vez de entregar var() ao xterm", () => {
	const host = document.createElement("div");
	host.style.setProperty("--background", "#1a1916");
	host.style.setProperty("--foreground", "#d7d7d7");
	document.body.append(host);
	try {
		expect(resolveTerminalTheme(host).background).toBe("#1a1916");
		host.style.setProperty("--background", "#e6ddc9");
		expect(resolveTerminalTheme(host).background).toBe("#e6ddc9");
	} finally {
		host.remove();
	}
});

test("arrastar rola linhas sem digitar setas, ignora tap e remove listeners ao desmontar", () => {
	const host = document.createElement("div");
	Object.defineProperty(host, "clientHeight", { value: 400 });
	const lines: number[] = [];
	const dispose = attachTerminalTouchScroll(
		host,
		{ rows: 20 } as Parameters<typeof attachTerminalTouchScroll>[1],
		(delta) => lines.push(delta),
	);
	function touch(type: string, y: number, count = 1) {
		const event = new Event(type, { cancelable: true });
		Object.defineProperty(event, "touches", {
			value: Array.from({ length: count }, () => ({ clientY: y })),
		});
		host.dispatchEvent(event);
		return event;
	}
	touch("touchstart", 100);
	expect(touch("touchmove", 104).defaultPrevented).toBe(false);
	expect(lines).toEqual([]);
	expect(touch("touchmove", 145).defaultPrevented).toBe(true);
	expect(lines).toEqual([-2]);
	touch("touchmove", 160);
	expect(lines).toEqual([-2, -1]);
	touch("touchcancel", 160);
	touch("touchstart", 160, 2);
	touch("touchmove", 80, 2);
	expect(lines).toEqual([-2, -1]);
	dispose();
	touch("touchstart", 160);
	touch("touchmove", 80);
	expect(lines).toEqual([-2, -1]);
});
