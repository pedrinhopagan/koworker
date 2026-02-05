import { sql } from "kysely";
import { z } from "zod";
import { db } from "@/cli/db";

const subtaskInputSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	status: z.enum(["pending", "in_execution", "executed"]).optional(),
	displayOrder: z.number().int().optional(),
});

const criterionSchema = z.object({
	id: z.string(),
	text: z.string(),
	done: z.boolean(),
});

const createTaskInputSchema = z
	.object({
		title: z.string().min(1),
		description: z.string().optional(),
		notes: z.string().optional(),
		ai_metadata: z.record(z.string(), z.unknown()).optional(),
		acceptance_criteria: z.array(criterionSchema).optional(),
		status: z.enum(["pending", "in_execution", "executed"]).optional(),
		projectId: z.string().min(1).optional(),
		projectName: z.string().min(1).optional(),
		categoryId: z.string().min(1).optional(),
		categoryName: z.string().min(1).optional(),
		priorityId: z.string().min(1).optional(),
		priorityName: z.string().min(1).optional(),
		subtasks: z.array(subtaskInputSchema).optional(),
	})
	.refine((v) => v.projectId || v.projectName, {
		message: "projectId ou projectName é obrigatório",
		path: ["projectId"],
	})
	.refine((v) => v.categoryId || v.categoryName, {
		message: "categoryId ou categoryName é obrigatório",
		path: ["categoryId"],
	})
	.refine((v) => v.priorityId || v.priorityName, {
		message: "priorityId ou priorityName é obrigatório",
		path: ["priorityId"],
	});

export async function createTask(args: string[]): Promise<void> {
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

	const result = createTaskInputSchema.safeParse(parsed);
	if (!result.success) {
		const issues = result.error.issues
			.map((i) => `  - ${i.path.join(".")}: ${i.message}`)
			.join("\n");
		throw new Error(`Validação falhou:\n${issues}`);
	}

	const input = result.data;
	const now = Date.now();

	const [project, category, priority] = await Promise.all([
		input.projectId
			? db
					.selectFrom("projects")
					.select(["id"])
					.where("id", "=", input.projectId)
					.executeTakeFirst()
			: db
					.selectFrom("projects")
					.select(["id"])
					.where(sql`lower(name)`, "=", input.projectName?.toLowerCase() ?? "")
					.where("deleted_at", "is", null)
					.executeTakeFirst(),
		input.categoryId
			? db
					.selectFrom("categories")
					.select(["id"])
					.where("id", "=", input.categoryId)
					.executeTakeFirst()
			: db
					.selectFrom("categories")
					.select(["id"])
					.where(sql`lower(name)`, "=", input.categoryName?.toLowerCase() ?? "")
					.executeTakeFirst(),
		input.priorityId
			? db
					.selectFrom("priorities")
					.select(["id"])
					.where("id", "=", input.priorityId)
					.executeTakeFirst()
			: db
					.selectFrom("priorities")
					.select(["id"])
					.where(sql`lower(name)`, "=", input.priorityName?.toLowerCase() ?? "")
					.executeTakeFirst(),
	]);

	if (!project) throw new Error("Projeto não encontrado");
	if (!category) throw new Error("Categoria não encontrada");
	if (!priority) throw new Error("Prioridade não encontrada");

	const taskId = crypto.randomUUID();

	await db.transaction().execute(async (trx) => {
		await trx
			.insertInto("tasks")
			.values({
				id: taskId,
				project_id: project.id,
				title: input.title,
				description: input.description ?? null,
				notes: input.notes ?? null,
				ai_metadata: input.ai_metadata ? JSON.stringify(input.ai_metadata) : null,
				priority_id: priority.id,
				category_id: category.id,
				status: input.status ?? "pending",
				acceptance_criteria: input.acceptance_criteria
					? JSON.stringify(input.acceptance_criteria)
					: null,
				created_at: now,
				updated_at: now,
			} as never)
			.execute();

		if (input.subtasks?.length) {
			let nextOrder = 0;
			for (const sub of input.subtasks) {
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
						task_id: taskId,
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
	});

	console.log(`Task criada com sucesso: ${taskId}`);
}
