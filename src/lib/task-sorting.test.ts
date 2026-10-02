import { expect, test } from "bun:test";

import { sortTasksByMode } from "@/lib/task-sorting";
import type { Task } from "@/types/tasks";

function task(id: string, done: boolean, lastEditedAt: number): Task {
	return {
		id,
		projectId: "project-1",
		folderPath: id,
		title: id,
		displayTitle: id,
		titleFromContent: false,
		groupId: undefined,
		displayOrder: 0,
		done,
		completedAt: undefined,
		createdAt: lastEditedAt,
		updatedAt: undefined,
		deletedAt: undefined,
		lastEditedAt,
		fileNames: [],
		artifactNames: [],
		worktree: null,
	};
}

test("mantém tarefas concluídas na ordem de período", () => {
	const tasks = [task("pendente-antiga", false, 100), task("concluida-recente", true, 200)];

	expect(sortTasksByMode(tasks, "recente").map((item) => item.id)).toEqual([
		"concluida-recente",
		"pendente-antiga",
	]);
});

test("ordem manual segue a posição salva sem alterar a lista original", () => {
	const tasks = [
		{ ...task("segunda", false, 200), displayOrder: 2 },
		{ ...task("primeira", false, 100), displayOrder: 1 },
	];
	expect(sortTasksByMode(tasks, "manual").map((item) => item.id)).toEqual(["primeira", "segunda"]);
	expect(tasks.map((item) => item.id)).toEqual(["segunda", "primeira"]);
});

test("ordem alfabética considera o título exibido", () => {
	const tasks = [
		{ ...task("a", false, 200), displayTitle: "Zebra" },
		{ ...task("z", true, 100), displayTitle: "Árvore" },
	];
	expect(sortTasksByMode(tasks, "alfabetica").map((item) => item.id)).toEqual(["z", "a"]);
});
