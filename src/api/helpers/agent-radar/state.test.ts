import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { matchProjectByCwd } from "./state";

const projects = [
	{ id: "app", name: "App", main_route: "/proj/app" },
	{ id: "pacote", name: "Pacote", main_route: "/proj/app/pacote" },
];

test("agent aberto na raiz do projeto casa com ele", () => {
	expect(matchProjectByCwd(projects, "/proj/app")?.id).toBe("app");
});

test("raiz aninhada vence: o agent está no pacote, não no app", () => {
	expect(matchProjectByCwd(projects, "/proj/app/pacote/src")?.id).toBe("pacote");
});

test("pasta fora de todo projeto não inventa vínculo", () => {
	expect(matchProjectByCwd(projects, "/proj/appx")).toBeNull();
	expect(matchProjectByCwd(projects, "/outro")).toBeNull();
});

test("aliases do mesmo diretório identificam o projeto", () => {
	const root = mkdtempSync(join(tmpdir(), "kowork-radar-"));
	const projectRoot = join(root, "project");
	const aliasRoot = join(root, "alias");
	mkdirSync(join(projectRoot, "src"), { recursive: true });
	symlinkSync(projectRoot, aliasRoot);

	try {
		expect(
			matchProjectByCwd(
				[{ id: "project", name: "Project", main_route: aliasRoot }],
				join(projectRoot, "src"),
			)?.id,
		).toBe("project");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
