import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	listProjectActions,
	parseGitStatus,
	pickUsefulScripts,
	runActionInBackground,
} from "./project-actions";

const dirs: string[] = [];

afterAll(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

describe("project-actions", () => {
	test("parseGitStatus lê branch, divergência e alterações", () => {
		const summary = parseGitStatus(
			"# branch.oid abc\n# branch.head main\n# branch.upstream origin/main\n# branch.ab +2 -1\n1 .M N... a.ts\n? novo.ts\n",
		);
		expect(summary).toEqual({ branch: "main", changes: 2, ahead: 2, behind: 1, hasUpstream: true });
	});

	test("monta ações de rota, docker, git e scripts com o modo padrão", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "kw-actions-"));
		dirs.push(cwd);
		await mkdir(join(cwd, ".git"));
		await writeFile(join(cwd, "compose.yaml"), "services: {}\n");
		await writeFile(
			join(cwd, "package.json"),
			JSON.stringify({ scripts: { dev: "x", "db:it's": "y", lint: "z" } }),
		);

		const actions = await listProjectActions({ main_route: cwd }, [
			{
				id: "r1",
				project_id: "p",
				name: "Reiniciar",
				route: cwd,
				command: "echo oi",
				background: 1,
				display_order: 0,
				created_at: 0,
			},
		]);
		const byId = Object.fromEntries(actions.map((action) => [action.id, action]));

		expect(byId["route:r1"]?.mode).toBe("background");
		expect(byId["docker:restart"]?.command).toBe("docker compose restart");
		expect(byId["docker:logs"]?.mode).toBe("terminal");
		expect(byId["git:pull"]?.mode).toBe("background");
		expect(byId["script:dev"]?.mode).toBe("terminal");
		expect(byId["script:dev"]?.command).toBe("bun run dev");
		expect(byId["script:db:it's"]?.command).toBe(`bun run 'db:it'\\''s'`);
		expect(byId["script:lint"]).toBeUndefined();
		expect(byId["git:status"]).toBeUndefined();
	});

	test("pickUsefulScripts mostra só o que se roda à mão", () => {
		const picked = pickUsefulScripts(
			{
				prepare: "husky",
				postinstall: "x",
				pretest: "y",
				dev: "bun run dev:run",
				"dev:run": "bun run build:engine && vite",
				"build:engine": "bun build",
				typecheck: "tsc",
				tc: "tsc",
				test: "bun test",
				"test:watch": "bun test --watch",
				"lint:conferir": "oxlint",
				check: "bun run typecheck && bun run lint:conferir",
				"db:reset": "rm db",
				clean: "rm -rf node_modules",
				"dist:dmg": "x --mac",
				"dist:linux": "x --linux",
				deploy: "bash deploy.sh",
				"deploy:fast": "bash hot.sh",
				simular: "bun simular.ts",
				arte: "bun arte.ts",
			},
			{
				typed: new Set(["simular", "test", "clean"]),
				covered: new Set(["deploy:fast"]),
				platform: "linux",
			},
		);
		expect(picked).toEqual(["dev", "db:reset", "deploy", "simular"]);
	});

	test("runActionInBackground devolve saída e código de saída", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "kw-actions-"));
		dirs.push(cwd);
		const base = {
			id: "x",
			group: "comando" as const,
			label: "x",
			icon: "x",
			cwd,
			mode: "background" as const,
		};

		const ok = await runActionInBackground({ ...base, command: "echo pronto" });
		expect(ok).toMatchObject({ ok: true, exitCode: 0, output: "pronto\n" });

		const fail = await runActionInBackground({ ...base, command: "echo ruim >&2; exit 3" });
		expect(fail).toMatchObject({ ok: false, exitCode: 3, output: "ruim\n" });
	});
});
