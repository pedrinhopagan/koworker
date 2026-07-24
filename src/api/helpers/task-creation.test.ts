import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "task-creation-test-secret";
process.env.NODE_ENV = "development";

const roots: string[] = [];
let db: typeof import("../db/connection").db;
let createTaskStorage: typeof import("./task-creation").createTaskStorage;

beforeAll(async () => {
	({ db } = await import("../db/connection"));
	({ createTaskStorage } = await import("./task-creation"));
});

afterAll(async () => {
	await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function createProject(input: { id: string; layoutVersion: 1 | 2 }) {
	const mainRoute = await mkdtemp(join(tmpdir(), `koworker-create-${input.id}-`));
	roots.push(mainRoute);
	await db
		.insertInto("projects")
		.values({
			id: input.id,
			name: input.id,
			color: "#000000",
			display_order: 0,
			main_route: mainRoute,
			hide_terminal: 0,
			task_layout_version: input.layoutVersion,
			created_at: 1,
		})
		.execute();

	return mainRoute;
}

describe("createTaskStorage", () => {
	test("cria v1 flat com identidade persistida", async () => {
		const projectId = "aaaaaaaa-0000-4000-8000-000000000011";
		const mainRoute = await createProject({ id: projectId, layoutVersion: 1 });
		const task = await createTaskStorage({
			projectId,
			title: "Árvore de decisões",
			complexity: "medio",
			seed: true,
		});
		if (!task?.storage_key) {
			throw new Error("Tarefa sem chave de storage");
		}

		expect(task.folder_path).toBe(`.koworker/${task.storage_key}`);
		expect(task.storage_slug).toBe("arvore-de-decisoes");
		expect(await Bun.file(join(mainRoute, task.folder_path, "index.md")).text()).toBe(
			"# Árvore de decisões\n",
		);
	});

	test("cria v2 sob a feature canônica e valida pertença ao projeto", async () => {
		const projectId = "aaaaaaaa-0000-4000-8000-000000000012";
		const otherProjectId = "aaaaaaaa-0000-4000-8000-000000000013";
		const mainRoute = await createProject({ id: projectId, layoutVersion: 2 });
		await createProject({ id: otherProjectId, layoutVersion: 2 });
		const groupId = "bbbbbbbb-0000-4000-8000-000000000012";
		await db
			.insertInto("task_groups")
			.values({
				id: groupId,
				project_id: projectId,
				name: "/Tarefas",
				storage_key: "bbbbbbbb",
				storage_slug: "tarefas",
				color: "#000000",
				display_order: 0,
				created_at: 1,
			})
			.execute();

		const task = await createTaskStorage({
			projectId,
			title: "Storage seguro",
			complexity: "complexo",
			groupId,
			seed: true,
		});
		if (!task?.storage_key) {
			throw new Error("Tarefa sem chave de storage");
		}

		expect(task.folder_path).toBe(
			`.koworker/tasks/tarefas--bbbbbbbb/storage-seguro--${task.storage_key}`,
		);
		expect(await Bun.file(join(mainRoute, task.folder_path, "index.md")).exists()).toBeTrue();

		let error: unknown;
		try {
			await createTaskStorage({
				projectId: otherProjectId,
				title: "Inválida",
				complexity: "medio",
				groupId,
				seed: true,
			});
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
	});

	test("preserva em quarentena a pasta criada quando o insert falha", async () => {
		const projectId = "aaaaaaaa-0000-4000-8000-000000000014";
		const mainRoute = await createProject({ id: projectId, layoutVersion: 1 });

		let error: unknown;
		try {
			await createTaskStorage({
				projectId,
				title: "Nunca perder",
				categoryId: "categoria-inexistente",
				complexity: "medio",
				seed: true,
			});
		} catch (caught) {
			error = caught;
		}

		const quarantineRoot = join(mainRoute, ".koworker", ".backups", "creation-rollbacks");
		const quarantined = await readdir(quarantineRoot);

		expect(error).toBeInstanceOf(Error);
		expect(quarantined).toHaveLength(1);
		expect(await Bun.file(join(quarantineRoot, quarantined[0], "index.md")).text()).toBe(
			"# Nunca perder\n",
		);
	});
});
