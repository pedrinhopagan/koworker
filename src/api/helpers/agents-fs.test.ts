import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "agents-fs-test-secret";
process.env.NODE_ENV = "development";

let db: typeof import("../db/connection").db;
let dbAgentSettings: typeof import("../db/agent-settings").dbAgentSettings;
let deleteAllAgentInFs: typeof import("./agents-fs").deleteAllAgentInFs;
let listAgentsFromFs: typeof import("./agents-fs").listAgentsFromFs;

const home = homedir();
const tempDirs: string[] = [];
const projectIds: string[] = [];

beforeAll(async () => {
	({ db } = await import("../db/connection"));
	({ dbAgentSettings } = await import("../db/agent-settings"));
	({ deleteAllAgentInFs, listAgentsFromFs } = await import("./agents-fs"));
});

describe("deleteAllAgentInFs", () => {
	test("faz backup verificado de cada cópia antes de remover o agent de todas as fontes", async () => {
		const global = await homeDir();
		const project = await homeDir();
		await writeAgent(global, "descartavel", "global", "corpo global");
		await writeAgent(
			join(project, ".claude/agents"),
			"descartavel",
			"do projeto",
			"corpo do projeto",
		);
		await addRow("claude-code", global, "global", 1);
		await addProject("Projeto do agent", project);
		await dbAgentSettings.upsert({
			slug: "descartavel",
			label: "Agent descartável",
			icon: "Trash2",
			color: "#123456",
		});

		const result = await deleteAllAgentInFs({ slug: "descartavel" });
		tempDirs.push(result.backupPath);

		expect(result.removed).toBe(2);
		expect(await Bun.file(join(global, "descartavel.md")).exists()).toBe(false);
		expect(await Bun.file(join(project, ".claude/agents/descartavel.md")).exists()).toBe(false);

		const sources = (await readdir(join(result.backupPath, "sources"))).sort();
		expect(sources).toEqual(["001-claude-code-global", "002-claude-code-project"]);
		expect(
			await readFile(join(result.backupPath, "sources", sources[0], "descartavel.md"), "utf8"),
		).toContain("corpo global");
		expect(
			await readFile(join(result.backupPath, "sources", sources[1], "descartavel.md"), "utf8"),
		).toContain("corpo do projeto");

		const manifest = JSON.parse(await readFile(join(result.backupPath, "manifest.json"), "utf8"));
		expect(manifest.slug).toBe("descartavel");
		expect(manifest.settings).toMatchObject({
			slug: "descartavel",
			label: "Agent descartável",
			icon: "Trash2",
			color: "#123456",
		});
		expect(manifest.sources).toHaveLength(2);
		expect(manifest.sources[0]).toMatchObject({
			tool: "claude-code",
			scope: "global",
			path: join(global, "descartavel.md"),
		});
	});

	test("recusa apagar quando não há nenhuma cópia removível", async () => {
		const global = await homeDir();
		await writeAgent(global, "existente", "global", "corpo");
		await addRow("claude-code", global, "global", 1);

		let error: Error | null = null;
		try {
			await deleteAllAgentInFs({ slug: "inexistente" });
		} catch (err: any) {
			error = err;
		}

		expect(error?.message).toBe("Nenhuma cópia removível deste agent foi encontrada");
		expect(await Bun.file(join(global, "existente.md")).exists()).toBe(true);
		expect((await listAgentsFromFs()).some((record) => record.slug === "existente")).toBe(true);
	});
});

describe("createDeleteBackup", () => {
	test("apaga o backup inteiro quando a cópia de uma das fontes falha", async () => {
		const { createDeleteBackup } = await import("./delete-backup");
		const root = await homeDir();

		let error: Error | null = null;
		try {
			await createDeleteBackup({
				root,
				slug: "parcial",
				settings: null,
				sources: [
					{ tool: "claude-code", scope: "global", path: "/primeira" },
					{ tool: "codex", scope: "project", path: "/segunda" },
				],
				copySource: async (source, target) => {
					if (source.path === "/segunda") {
						throw new Error("cópia falhou");
					}
					await Bun.write(join(target, "agent.md"), "conteúdo");

					return {};
				},
			});
		} catch (err: any) {
			error = err;
		}

		expect(error?.message).toBe("cópia falhou");
		expect(await readdir(root)).toEqual([]);
	});
});

afterEach(async () => {
	await db.deleteFrom("agent_source_paths").execute();
	await db.deleteFrom("agent_settings").execute();
	const ownedProjectIds = projectIds.splice(0);
	if (ownedProjectIds.length > 0) {
		await db.deleteFrom("projects").where("id", "in", ownedProjectIds).execute();
	}
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function addRow(tool: string, path: string, scope: string, createdAt: number) {
	await db
		.insertInto("agent_source_paths")
		.values({ id: crypto.randomUUID(), tool, path, scope, created_at: createdAt })
		.execute();
}

async function addProject(name: string, mainRoute: string) {
	const projectId = crypto.randomUUID();
	projectIds.push(projectId);
	await db
		.insertInto("projects")
		.values({
			id: projectId,
			name,
			color: "#000000",
			display_order: 0,
			main_route: mainRoute,
			hide_terminal: 0,
			task_layout_version: 1,
			created_at: Date.now(),
		})
		.execute();
}

async function writeAgent(dir: string, slug: string, description: string, body: string) {
	await mkdir(dir, { recursive: true });
	await writeFile(
		join(dir, `${slug}.md`),
		`---\nname: ${slug}\ndescription: ${description}\n---\n\n${body}\n`,
	);
}

async function homeDir(): Promise<string> {
	const dir = join(home, `.koworker-test-${crypto.randomUUID()}`);
	await mkdir(dir, { recursive: true });
	tempDirs.push(dir);
	return dir;
}
