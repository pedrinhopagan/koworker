import { expect, test } from "bun:test";

import { resolveRegisteredFile } from "./registered-file";

test("resolve projeto e arquivo canônico sem confundir prefixos ou worktrees", async () => {
	const projects = ["/projeto", "/projeto/interno"].map((main_route) => ({
		id: main_route,
		main_route,
	}));
	const tasks = [
		{
			id: "tarefa",
			group_id: null,
			main_route: "/projeto",
			folder_path: ".koworker/tarefa",
			worktree_path: "/worktree",
		},
	];
	const resolveLinkTarget = ({ target }: { target: string }) =>
		resolveRegisteredFile({ path: target, tasks, projects });
	for (const path of [
		"/projeto/.koworker/tarefa/apresentação.html",
		"/worktree/relatório.PDF",
		"/projeto/página.htm",
	]) {
		expect(resolveLinkTarget({ target: path })).toMatchObject({
			kind: "file",
			path,
			projectId: "/projeto",
		});
	}

	expect(
		await resolveLinkTarget({ target: "/projeto/.koworker/tarefa/plano final.md" }),
	).toMatchObject({
		kind: "internal",
		projectId: "/projeto",
		fileHref: "/tarefas/sem-feature/tarefa/plano%20final.md",
	});
	expect(await resolveLinkTarget({ target: "/projeto/interno/src/app.ts" })).toMatchObject({
		kind: "file",
		projectId: "/projeto/interno",
	});
	expect(await resolveLinkTarget({ target: "/projeto-outro/arquivo.md" })).toMatchObject({
		kind: "file",
		projectId: undefined,
	});
	for (const target of [
		"/worktree/plano.md",
		"/projeto/.koworker/tarefa/imagem.png",
		"/projeto/.koworker/tarefa/sub/arquivo.md",
	]) {
		expect(await resolveLinkTarget({ target })).toMatchObject({
			kind: "internal",
			projectId: "/projeto",
			fileHref: null,
		});
	}
});
