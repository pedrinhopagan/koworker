import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "tasks-watcher-test-secret";
process.env.NODE_ENV = "development";

const {
	isIgnoredWatchPath,
	releaseTaskWatcher,
	startTasksWatcher,
	stopTasksWatcher,
	suppressTaskWatcher,
} = await import("./tasks-watcher");
const { db } = await import("../db/connection");
const { PubSub } = await import("../pubsub");

const root = "/projeto/.koworker";

describe("isIgnoredWatchPath", () => {
	test("observa os arquivos das tarefas e as mídias", () => {
		for (const path of [
			root,
			`${root}/tasks`,
			`${root}/tasks/feature--a1b2c3d4`,
			`${root}/tasks/feature--a1b2c3d4/tarefa--e5f6a7b8`,
			`${root}/tasks/feature--a1b2c3d4/tarefa--e5f6a7b8/index.md`,
			`${root}/tasks/feature--a1b2c3d4/tarefa--e5f6a7b8/v1/plano.md`,
			`${root}/medias/imagem.png`,
		]) {
			expect(isIgnoredWatchPath(root, path)).toBe(false);
		}
	});

	test("ignora as áreas internas do storage e as pastas pesadas de dentro da tarefa", () => {
		for (const path of [
			`${root}/.backups/layout-v2/run/files/tarefa/index.md`,
			`${root}/.staging/run/tarefa/index.md`,
			`${root}/videos/tmp/render.mp4`,
			`${root}/tasks/feature--a1b2c3d4/tarefa--e5f6a7b8/node_modules/pacote/index.js`,
			`${root}/tasks/feature--a1b2c3d4/tarefa--e5f6a7b8/v1/assets/piper/voz.onnx`,
			`${root}/tasks/feature--a1b2c3d4/tarefa--e5f6a7b8/scratchpad/perfil/cache`,
		]) {
			expect(isIgnoredWatchPath(root, path)).toBe(true);
		}
	});
});

describe("supressão do watcher", () => {
	const suppressedId = "aaaaaaaa-0000-4000-8000-000000000071";
	const freeId = "aaaaaaaa-0000-4000-8000-000000000072";
	let temporaryRoot: string;
	let controller: AbortController;
	const published: string[] = [];

	async function touch(projectId: string, name: string) {
		await Bun.write(
			join(temporaryRoot, projectId, ".koworker", "tasks", "_sem-feature", "t--1111", name),
			`# ${name}\n`,
		);
	}

	beforeAll(async () => {
		temporaryRoot = await mkdtemp(join(tmpdir(), "koworker-tasks-watcher-"));

		for (const [index, projectId] of [suppressedId, freeId].entries()) {
			await mkdir(join(temporaryRoot, projectId, ".koworker", "tasks", "_sem-feature", "t--1111"), {
				recursive: true,
			});
			await db
				.insertInto("projects")
				.values({
					id: projectId,
					name: `Watcher ${index}`,
					color: "#000000",
					display_order: index,
					main_route: join(temporaryRoot, projectId),
					hide_terminal: 0,
					task_layout_version: 2,
					created_at: 1,
				})
				.execute();
		}

		controller = new AbortController();
		void (async () => {
			for await (const event of PubSub.subscribe("tasks", "global", controller.signal)) {
				published.push(event.projectId);
			}
		})().catch(() => {});

		await startTasksWatcher();
		await Bun.sleep(300);
	});

	afterAll(async () => {
		controller.abort();
		await stopTasksWatcher();
		await db.deleteFrom("projects").where("id", "in", [suppressedId, freeId]).execute();
		await rm(temporaryRoot, { recursive: true, force: true });
	});

	test("um projeto suprimido não é liberado pelo flush de outro projeto", async () => {
		suppressTaskWatcher(suppressedId);
		published.length = 0;

		await touch(suppressedId, "silencioso.md");
		await touch(freeId, "livre.md");
		await Bun.sleep(1200);

		expect(published).toContain(freeId);
		expect(published).not.toContain(suppressedId);

		published.length = 0;
		releaseTaskWatcher(suppressedId);
		await Bun.sleep(600);

		expect(published).toContain(suppressedId);
	});
});
