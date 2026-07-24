import { describe, expect, test } from "bun:test";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "tasks-watcher-test-secret";
process.env.NODE_ENV = "development";

const { isIgnoredWatchPath } = await import("./tasks-watcher");

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
