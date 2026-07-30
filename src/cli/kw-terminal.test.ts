import { expect, test } from "bun:test";

import { NO_FEATURE_ROUTE_ID } from "@/routes/_app/tarefas/-utils/task-route-resolution";
import { sessionTaskArgs } from "./kw-terminal";

test("monta a rota canônica da tarefa", () => {
	const args = sessionTaskArgs({ id: "task-1", title: "Navegação", groupId: "feature-1" });

	expect(args).toEqual([
		"--task-id",
		"task-1",
		"--title",
		"Navegação",
		"--route",
		"/tarefas/feature-1/task-1",
	]);
});

test("tarefa sem feature usa o segmento de vínculo nulo", () => {
	const args = sessionTaskArgs({ id: "task-1", title: "Navegação", groupId: null });

	expect(args).toContain(`/tarefas/${NO_FEATURE_ROUTE_ID}/task-1`);
});

test("tarefa sem título vira um rótulo legível", () => {
	const args = sessionTaskArgs({ id: "task-1", title: "   ", groupId: "feature-1" });

	expect(args[3]).toBe("Sem título");
});

test("o arquivo ativo vira a rota do editor, com o nome escapado", () => {
	const args = sessionTaskArgs({
		id: "task-1",
		title: "Navegação",
		groupId: "feature-1",
		file: "plano de ação.md",
	});

	expect(args.at(-2)).toBe("--file-route");
	expect(args.at(-1)).toBe("/tarefas/feature-1/task-1/plano%20de%20a%C3%A7%C3%A3o.md");
});
