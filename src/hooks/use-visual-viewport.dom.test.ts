import { expect, test } from "bun:test";

import { act, renderHook } from "../../tests/web/testing-library";
import { useVisualViewport } from "./use-visual-viewport";

test("a área visível acompanha teclado e deslocamento, preserva zoom e limpa ao sair", () => {
	const original = window.visualViewport;
	const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
	Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
	const hook = renderHook(() => useVisualViewport());
	const style = document.documentElement.style;
	try {
		expect(style.getPropertyValue("--app-viewport-height")).toBe("844px");
		act(() => {
			viewport.height = 420;
			viewport.offsetTop = 64;
			viewport.dispatchEvent(new Event("resize"));
		});
		expect(style.getPropertyValue("--app-viewport-height")).toBe("420px");
		expect(style.getPropertyValue("--app-viewport-top")).toBe("64px");
		act(() => {
			viewport.scale = 2;
			viewport.height = 210;
			viewport.dispatchEvent(new Event("resize"));
		});
		expect(style.getPropertyValue("--app-viewport-height")).toBe("420px");
	} finally {
		hook.unmount();
		Object.defineProperty(window, "visualViewport", { configurable: true, value: original });
	}
	expect(style.getPropertyValue("--app-viewport-height")).toBe("");
});
