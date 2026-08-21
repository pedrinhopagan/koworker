import { describe, expect, test } from "bun:test";

import { resolveLinuxOzonePlatform } from "./linux-platform";

describe("resolveLinuxOzonePlatform", () => {
	test("força X11 somente quando há um display X disponível", () => {
		expect(resolveLinuxOzonePlatform(":0")).toBe("x11");
		expect(resolveLinuxOzonePlatform()).toBeNull();
		expect(resolveLinuxOzonePlatform(" ")).toBeNull();
	});

	test("prefere Wayland mesmo com Xwayland exportando DISPLAY", () => {
		expect(resolveLinuxOzonePlatform(":0", "wayland-0")).toBe("wayland");
		expect(resolveLinuxOzonePlatform(undefined, "wayland-0")).toBe("wayland");
	});
});
