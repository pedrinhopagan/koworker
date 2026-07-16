import { afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "task-sync-test-secret";
process.env.NODE_ENV = "development";

let db: typeof import("../db/connection").db;
let discoverTaskFolders: typeof import("./task-sync").discoverTaskFolders;
let createDiscoveredTasks: typeof import("./task-sync").createDiscoveredTasks;
let projectRoute: string;
let projectId: string;

beforeAll(async () => {
	({ db } = await import("../db/connection"));
	({ createDiscoveredTasks, discoverTaskFolders } = await import("./task-sync"));
});

beforeEach(async () => {
	projectRoute = await mkdtemp(join(tmpdir(), "kowork-task-sync-"));
	projectId = crypto.randomUUID();

	await db
		.insertInto("projects")
		.values({
			id: projectId,
			name: "Projeto de teste",
			color: "#000000",
			display_order: 0,
			main_route: projectRoute,
			hide_terminal: 0,
			created_at: Date.now(),
		})
		.execute();
});

afterEach(async () => {
	await db.deleteFrom("tasks").where("project_id", "=", projectId).execute();
	await db.deleteFrom("projects").where("id", "=", projectId).execute();
	await rm(projectRoute, { recursive: true, force: true });
});

describe("sincronização de tarefas", () => {
	test("descobre pastas ausentes e infere o título pelo primeiro markdown", async () => {
		await mkdir(join(projectRoute, ".koworker", "nova-tarefa"), { recursive: true });
		await mkdir(join(projectRoute, ".koworker", "vazia"), { recursive: true });
		await mkdir(join(projectRoute, ".koworker", "medias"), { recursive: true });
		await Bun.write(
			join(projectRoute, ".koworker", "nova-tarefa", "index.md"),
			"\n# Título detectado\n",
		);
		await Bun.write(join(projectRoute, ".koworker", "medias", "imagem.md"), "ignorada");

		const discovered = await discoverTaskFolders(projectId);

		expect(discovered).toEqual([
			{
				projectId,
				projectName: "Projeto de teste",
				folderName: "nova-tarefa",
				folderPath: ".koworker/nova-tarefa",
				title: "Título detectado",
				fileCount: 1,
			},
		]);
	});

	test("cria o registro sem alterar a pasta e não oferece a tarefa novamente", async () => {
		await mkdir(join(projectRoute, ".koworker", "importada"), { recursive: true });
		await Bun.write(join(projectRoute, ".koworker", "importada", "index.md"), "# Original\n");

		const result = await createDiscoveredTasks({
			tasks: [
				{
					projectId,
					folderName: "importada",
					title: "Título editado",
					complexity: "complexo",
					done: true,
				},
			],
		});
		const row = await db
			.selectFrom("tasks as t")
			.selectAll("t")
			.where("t.project_id", "=", projectId)
			.executeTakeFirstOrThrow();

		expect(result).toEqual({ created: 1 });
		expect(row.folder_path).toBe(".koworker/importada");
		expect(row.title).toBe("Título editado");
		expect(row.complexity).toBe("complexo");
		expect(row.done).toBe(1);
		expect(row.completed_at).toBeNumber();
		expect(await Bun.file(join(projectRoute, ".koworker", "importada", "index.md")).text()).toBe(
			"# Original\n",
		);
		expect(await discoverTaskFolders(projectId)).toEqual([]);
	});
});
