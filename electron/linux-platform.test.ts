import { describe, expect, test } from "bun:test";

import { resolveLinuxOzonePlatform } from "./linux-platform";

describe("resolveLinuxOzonePlatform", () => {
	test("força X11 somente quando há um display X disponível", () => {
		expect(resolveLinuxOzonePlatform(":0")).toBe("x11");
		expect(resolveLinuxOzonePlatform()).toBeNull();
		expect(resolveLinuxOzonePlatform(" ")).toBeNull();
	});
});
