import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, stat, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { RECENCY_IGNORE_OFFSET_MS } from "@/constants/tasks";
import { shiftTaskFolderEditedAt } from "./task-folder";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "task-recency-test-secret";
process.env.NODE_ENV = "development";

let db: typeof import("../db/connection").db;
let dbTasks: typeof import("../db/tasks").dbTasks;
let projectRoute: string;

beforeAll(async () => {
	({ db } = await import("../db/connection"));
	({ dbTasks } = await import("../db/tasks"));
	projectRoute = await mkdtemp(join(tmpdir(), "kowork-task-recency-"));

	await db
		.insertInto("projects")
		.values({
			id: "project-recency",
			name: "Projeto",
			color: "#000000",
			display_order: 0,
			main_route: projectRoute,
			hide_terminal: 0,
			created_at: Date.now(),
		})
		.execute();
});

afterAll(async () => {
	await rm(projectRoute, { recursive: true, force: true });
});

describe("recência de tarefas", () => {
	test("retrocede criação e atualização no banco", async () => {
		const createdAt = Date.now() - 2_000;
		const updatedAt = Date.now() - 1_000;

		await dbTasks.create({
			id: "task-recency",
			project_id: "project-recency",
			folder_path: ".koworker/task-recency",
			title: "Tarefa",
			created_at: createdAt,
			updated_at: updatedAt,
		});
		await dbTasks.ignoreRecency({
			id: "task-recency",
			createdAt: createdAt - RECENCY_IGNORE_OFFSET_MS,
			updatedAt: updatedAt - RECENCY_IGNORE_OFFSET_MS,
		});

		const task = await dbTasks.getById("task-recency");

		expect(task?.created_at).toBe(createdAt - RECENCY_IGNORE_OFFSET_MS);
		expect(task?.updated_at).toBe(updatedAt - RECENCY_IGNORE_OFFSET_MS);
	});

	test("retrocede arquivos markdown preservando a distância entre edições", async () => {
		const folderPath = ".koworker/files-recency";
		const dir = join(projectRoute, folderPath);
		await mkdir(dir, { recursive: true });
		await Bun.write(join(dir, "index.md"), "# Índice");
		await Bun.write(join(dir, "plano.md"), "# Plano");
		await Bun.write(join(dir, "imagem.png"), "artefato");

		const recent = Date.now() - 1_000;
		const older = recent - 5_000;
		await utimes(join(dir, "index.md"), new Date(older), new Date(older));
		await utimes(join(dir, "plano.md"), new Date(recent), new Date(recent));
		const artifactBefore = await stat(join(dir, "imagem.png"));

		await shiftTaskFolderEditedAt({ projectRoute, folderPath, offsetMs: RECENCY_IGNORE_OFFSET_MS });

		const index = await stat(join(dir, "index.md"));
		const plan = await stat(join(dir, "plano.md"));
		const artifact = await stat(join(dir, "imagem.png"));

		expect(index.mtimeMs).toBeCloseTo(older - RECENCY_IGNORE_OFFSET_MS, -1);
		expect(plan.mtimeMs).toBeCloseTo(recent - RECENCY_IGNORE_OFFSET_MS, -1);
		expect(plan.mtimeMs - index.mtimeMs).toBeCloseTo(recent - older, -1);
		expect(artifact.mtimeMs).toBe(artifactBefore.mtimeMs);
	});

	test("mantém a ação disponível quando a pasta da tarefa não existe", async () => {
		await shiftTaskFolderEditedAt({
			projectRoute,
			folderPath: ".koworker/ausente",
			offsetMs: RECENCY_IGNORE_OFFSET_MS,
		});
	});
});
