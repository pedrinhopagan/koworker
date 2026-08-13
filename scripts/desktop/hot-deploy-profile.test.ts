import { describe, expect, test } from "bun:test";

import { resolveHotDeployProfile } from "./hot-deploy-profile";

describe("resolveHotDeployProfile", () => {
	test("isola o redeploy remoto do ciclo de vida da GUI", () => {
		expect(resolveHotDeployProfile("1")).toEqual({
			buildGui: false,
			requireSystemd: true,
		});
	});

	test("mantem a GUI no deploy local", () => {
		expect(resolveHotDeployProfile("")).toEqual({
			buildGui: true,
			requireSystemd: false,
		});
	});
});
