import { z } from "zod";
import { db } from "@/cli/db";
import { parseJsonInput } from "./schemas";

const readTaskInputSchema = z.object({
	taskId: z.string(),
});

export async function readTask(args: string[]): Promise<void> {
	const input = parseJsonInput(args[0], readTaskInputSchema);

	const task = await db
		.selectFrom("tasks")
		.selectAll()
		.where("id", "=", input.taskId)
		.where("deleted_at", "is", null)
		.executeTakeFirst();

	if (!task) {
		throw new Error(`Task ${input.taskId} não encontrada`);
	}

	const project = await db
		.selectFrom("projects")
		.select(["name", "main_route"])
		.where("id", "=", task.project_id)
		.executeTakeFirst();

	const category = await db
		.selectFrom("categories")
		.select(["name"])
		.where("id", "=", task.category_id)
		.executeTakeFirst();

	const priority = await db
		.selectFrom("priorities")
		.select(["name"])
		.where("id", "=", task.priority_id)
		.executeTakeFirst();

	const subtasks = await db
		.selectFrom("subtasks")
		.selectAll()
		.where("task_id", "=", task.id)
		.orderBy("display_order", "asc")
		.execute();

	const acceptanceCriteria: Array<{ id: string; text: string; done: boolean }> =
		task.acceptance_criteria ? JSON.parse(task.acceptance_criteria) : [];

	const aiMetadata: unknown = task.ai_metadata ? JSON.parse(task.ai_metadata) : null;

	console.log(
		JSON.stringify(
			{
				id: task.id,
				title: task.title,
				status: task.status,
				description: task.description ?? null,
				notes: task.notes ?? null,
				project: project ? { name: project.name, mainRoute: project.main_route } : null,
				category: category?.name ?? null,
				priority: priority?.name ?? null,
				acceptanceCriteria,
				aiMetadata,
				subtasks: subtasks.map((s) => ({
					id: s.id,
					title: s.title,
					description: s.description ?? null,
					status: s.status,
					displayOrder: s.display_order,
				})),
			},
			null,
			2,
		),
	);
}
