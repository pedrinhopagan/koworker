import { z } from "zod";
import { db } from "@/cli/db";

const subtaskInputSchema = z.object({
	id: z.string().optional(),
	title: z.string().min(1),
	description: z.string().optional(),
	status: z.enum(["pending", "in_execution", "executed"]).optional(),
});

const criterionSchema = z.object({
	id: z.string(),
	text: z.string(),
	done: z.boolean(),
});

const updateTaskInputSchema = z.object({
	taskId: z.string(),
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	status: z.enum(["pending", "in_execution", "executed"]).optional(),
	notes: z.string().optional(),
	ai_metadata: z.record(z.string(), z.unknown()).optional(),
	acceptance_criteria: z.array(criterionSchema).optional(),
	subtasks: z.array(subtaskInputSchema).optional(),
});

export async function updateTask(args: string[]): Promise<void> {
	const jsonInput = args[0];
	if (!jsonInput) {
		throw new Error("JSON de input é obrigatório");
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonInput);
	} catch {
		throw new Error("JSON inválido");
	}

	const result = updateTaskInputSchema.safeParse(parsed);
	if (!result.success) {
		const issues = result.error.issues
			.map((i) => `  - ${i.path.join(".")}: ${i.message}`)
			.join("\n");
		throw new Error(`Validação falhou:\n${issues}`);
	}

	const input = result.data;
	const now = Date.now();

	await db.transaction().execute(async (trx) => {
		const task = await trx
			.selectFrom("tasks")
			.select(["id"])
			.where("id", "=", input.taskId)
			.executeTakeFirst();

		if (!task) {
			throw new Error(`Task ${input.taskId} não encontrada`);
		}

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
			for (const sub of input.subtasks) {
				if (sub.id) {
					const subUpdates: Record<string, unknown> = { updated_at: now };
					if (sub.title) subUpdates.title = sub.title;
					if (sub.description !== undefined) subUpdates.description = sub.description;
					if (sub.status) subUpdates.status = sub.status;

					await trx.updateTable("subtasks").set(subUpdates).where("id", "=", sub.id).execute();
				} else {
					await trx
						.insertInto("subtasks")
						.values({
							id: crypto.randomUUID(),
							task_id: input.taskId,
							title: sub.title,
							description: sub.description ?? null,
							status: sub.status ?? "pending",
							created_at: now,
							updated_at: now,
						} as never)
						.execute();
				}
			}
		}
	});

	console.log(`Task ${input.taskId} atualizada com sucesso`);
}
