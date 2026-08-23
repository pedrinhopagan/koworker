import { describe, expect, test } from "bun:test";

import { buildSystemdRunArgv, spawnDetachedFromService } from "./detached-process";

describe("buildSystemdRunArgv", () => {
	test("unidade transitória com argv separado por --", () => {
		const argv = buildSystemdRunArgv({
			unit: "kw-terminal-server",
			description: "Daemon do kw-terminal",
			argv: ["kw-terminal", "server"],
		});

		expect(argv[0]).toBe("systemd-run");
		expect(argv).toContain("--user");
		expect(argv).toContain("--collect");
		expect(argv).toContain("--unit=kw-terminal-server");
		const separator = argv.indexOf("--");
		expect(separator).toBeGreaterThan(0);
		expect(argv.slice(separator + 1)).toEqual(["kw-terminal", "server"]);
	});

	test("PATH garantido para o filho não depender do ambiente do serviço", () => {
		const argv = buildSystemdRunArgv({
			unit: "u",
			description: "d",
			argv: ["x"],
		});

		expect(argv.some((arg) => arg.startsWith("--setenv=PATH="))).toBe(true);
	});

	test("loginShell embrulha o comando em bash -lc com exec e quoting", () => {
		const argv = buildSystemdRunArgv({
			unit: "kowork-redeploy",
			description: "Redeploy",
			argv: ["bun", "run", "scripts/desktop/remote-redeploy.ts"],
			loginShell: true,
			cwd: "/repo",
		});

		expect(argv).toContain("--working-directory=/repo");
		const separator = argv.indexOf("--");
		expect(argv.slice(separator + 1)).toEqual([
			"bash",
			"-lc",
			"exec bun run scripts/desktop/remote-redeploy.ts",
		]);
	});

	test("loginShell escapa argumentos com espaço", () => {
		const argv = buildSystemdRunArgv({
			unit: "u",
			description: "d",
			argv: ["echo", "dois espaços"],
			loginShell: true,
		});

		expect(argv.at(-1)).toContain(`'dois espaços'`);
	});
});

describe("spawnDetachedFromService", () => {
	test("sem systemd-run no PATH, cai no spawn direto", () => {
		if (Bun.which("systemd-run")) {
			return;
		}

		const result = spawnDetachedFromService({
			unit: "probe-inexistente",
			description: "probe",
			argv: ["true"],
		});

		expect(result.via).toBe("direct");
	});
});
