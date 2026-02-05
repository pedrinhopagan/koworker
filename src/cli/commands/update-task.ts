import { z } from "zod";
import { db } from "@/cli/db";
import { notifyTaskChange } from "./notify-backend";
import {
	criterionSchema,
	parseJsonInput,
	taskStatusSchema,
	updateSubtaskInputSchema,
} from "./schemas";

const updateTaskInputSchema = z.object({
	taskId: z.string(),
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	status: taskStatusSchema.optional(),
	notes: z.string().optional(),
	ai_metadata: z.record(z.string(), z.unknown()).optional(),
	acceptance_criteria: z.array(criterionSchema).optional(),
	subtasks: z.array(updateSubtaskInputSchema).optional(),
});

export async function updateTask(args: string[]): Promise<void> {
	const input = parseJsonInput(args[0], updateTaskInputSchema);
	const now = Date.now();
	let projectId = "";

	await db.transaction().execute(async (trx) => {
		const task = await trx
			.selectFrom("tasks")
			.select(["id", "project_id"])
			.where("id", "=", input.taskId)
			.executeTakeFirst();

		if (!task) {
			throw new Error(`Task ${input.taskId} não encontrada`);
		}

		projectId = task.project_id;

		const updates: Record<string, unknown> = { updated_at: now };

		if (input.title) updates.title = input.title;
		if (input.description !== undefined) updates.description = input.description;
		if (input.status) updates.status = input.status;
		if (input.notes !== undefined) updates.notes = input.notes;
		if (input.ai_metadata !== undefined) updates.ai_metadata = JSON.stringify(input.ai_metadata);
		if (input.acceptance_criteria !== undefined) {
			updates.acceptance_criteria = JSON.stringify(input.acceptance_criteria);
		}

		await trx.updateTable("tasks").set(updates).where("id", "=", input.taskId).execute();

		if (input.subtasks) {
			const subtasksWithId = input.subtasks.filter((subtask) => Boolean(subtask.id));

			if (subtasksWithId.length) {
				const existingSubtasks = await trx
					.selectFrom("subtasks")
					.select(["id", "task_id"])
					.where(
						"id",
						"in",
						subtasksWithId.map((subtask) => subtask.id as string),
					)
					.execute();

				const subtaskById = new Map(existingSubtasks.map((subtask) => [subtask.id, subtask]));

				for (const subtask of subtasksWithId) {
					const existingSubtask = subtaskById.get(subtask.id as string);

					if (!existingSubtask) {
						throw new Error(`Subtask ${subtask.id} não encontrada`);
					}

					if (existingSubtask.task_id !== input.taskId) {
						throw new Error(`Subtask ${subtask.id} não pertence à task ${input.taskId}`);
					}
				}
			}

			const maxOrder = (await trx
				.selectFrom("subtasks")
				.select(({ fn }) => [fn.max("display_order").as("maxOrder")])
				.where("task_id", "=", input.taskId)
				.executeTakeFirst()) as { maxOrder?: number | null } | undefined;
			let nextOrder = ((maxOrder?.maxOrder as number | null) ?? -1) + 1;

			for (const sub of input.subtasks) {
				if (sub.id) {
					const subUpdates: Record<string, unknown> = { updated_at: now };
					if (sub.title) subUpdates.title = sub.title;
					if (sub.description !== undefined) subUpdates.description = sub.description;
					if (sub.status) subUpdates.status = sub.status;
					if (typeof sub.displayOrder === "number") subUpdates.display_order = sub.displayOrder;

					await trx
						.updateTable("subtasks")
						.set(subUpdates)
						.where("id", "=", sub.id)
						.where("task_id", "=", input.taskId)
						.execute();
				} else {
					let displayOrder = sub.displayOrder;
					if (typeof displayOrder !== "number") {
						displayOrder = nextOrder;
						nextOrder += 1;
					} else if (displayOrder >= nextOrder) {
						nextOrder = displayOrder + 1;
					}

					await trx
						.insertInto("subtasks")
						.values({
							id: crypto.randomUUID(),
							task_id: input.taskId,
							title: sub.title,
							description: sub.description ?? null,
							status: sub.status ?? "pending",
							display_order: displayOrder,
							created_at: now,
							updated_at: now,
						} as never)
						.execute();
				}
			}
		}
	});

	if (projectId) {
		await notifyTaskChange({
			taskId: input.taskId,
			projectId,
			action: "updated",
		});
	}

	console.log(`Task ${input.taskId} atualizada com sucesso`);
}
