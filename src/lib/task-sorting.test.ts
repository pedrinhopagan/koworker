import { expect, test } from "bun:test";

import { sortTasksByMode } from "@/lib/task-sorting";
import type { TaskWithMeta } from "@/types/tasks";

function task(id: string, done: boolean, lastEditedAt: number): TaskWithMeta {
	return {
		id,
		projectId: "project-1",
		folderPath: id,
		title: id,
		displayTitle: id,
		titleFromContent: false,
		priorityId: undefined,
		categoryId: undefined,
		complexity: "medio",
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
		category: null,
		priority: null,
	};
}

test("mantém tarefas concluídas na ordem de período", () => {
	const tasks = [task("pendente-antiga", false, 100), task("concluida-recente", true, 200)];

	expect(sortTasksByMode(tasks, "recente", [], []).map((item) => item.id)).toEqual([
		"concluida-recente",
		"pendente-antiga",
	]);
});
