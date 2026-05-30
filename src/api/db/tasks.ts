import { sql } from "kysely";

import {
	type TaskDbCreateInput,
	TaskDbCreateSchema,
	type TaskDbUpdateInput,
	TaskDbUpdateSchema,
	type TaskListFiltersInput,
} from "../schemas/tasks";
import { db, type tasks } from "./connection";
import { cleanUpdate } from "./helpers";

const applyTaskListFilters = (
	// biome-ignore lint/suspicious/noExplicitAny: Kysely's builder type is too generic here and propagates poorly; keep helper flexible.
	query: any,
	filters?: (TaskListFiltersInput & { projectId?: string | null }) | null,
) => {
	if (!filters) return query;

	if (filters.projectId) {
		query = query.where("project_id", "=", filters.projectId);
	}

	if (filters.taskTypeId) {
		query = query.where("category_id", "=", filters.taskTypeId);
	}

	const priorityId = filters.priorityId ?? filters.priority;
	if (priorityId) {
		query = query.where("priority_id", "=", priorityId);
	}

	if (filters.q) {
		query = query.where("title", "like", `%${filters.q.trim()}%`);
	}

	return query;
};

export const dbTasks = {
	getById: (id: string) =>
		db
			.selectFrom("tasks")
			.selectAll()
			.where("id", "=", id)
			.where("deleted_at", "is", null)
			.executeTakeFirst(),

	getByFolderPath: (folderPath: string) =>
		db
			.selectFrom("tasks")
			.selectAll()
			.where("folder_path", "=", folderPath)
			.where("deleted_at", "is", null)
			.executeTakeFirst(),

	listByProject: (input: { projectId: string } & TaskListFiltersInput) => {
		let query = db.selectFrom("tasks").selectAll().where("deleted_at", "is", null);

		query = applyTaskListFilters(query, input);
		return query.execute();
	},

	getAll: (
		input: {
			projectId?: string | null;
			includeCompleted?: boolean;
		} & TaskListFiltersInput,
	) => {
		let query = db.selectFrom("tasks").selectAll().where("deleted_at", "is", null);

		// Exclude completed tasks by default.
		if (!input.includeCompleted) {
			query = query.where("done", "=", 0);
		}

		query = applyTaskListFilters(query, input);
		// Ordem-base estável; o agrupamento final (grupo → categoria → display_order) é
		// resolvido no frontend, que tem o display_order de grupos e categorias.
		query = query.orderBy("display_order", "asc").orderBy("created_at", "desc");
		return query.execute();
	},

	// Backlog da agenda: tarefas pendentes ainda NÃO ligadas a um event. Fonte do DnD para
	// agendar. "Sem agendamento" agora = sem event de ligação (a tabela events é dona do tempo).
	listBacklog: (input: { projectId?: string | null } & TaskListFiltersInput) => {
		let query = db
			.selectFrom("tasks")
			.selectAll()
			.where("deleted_at", "is", null)
			.where("done", "=", 0)
			.where((eb) =>
				eb(
					"id",
					"not in",
					eb
						.selectFrom("events")
						.select("task_id")
						.where("task_id", "is not", null)
						.$castTo<string>(),
				),
			);

		query = applyTaskListFilters(query, input);
		query = query.orderBy("display_order", "asc").orderBy("created_at", "desc");
		return query.execute();
	},

	create: (input: TaskDbCreateInput) => {
		const parsed = TaskDbCreateSchema.parse(input);
		return db
			.insertInto("tasks")
			.values(parsed as tasks)
			.onConflict((oc) => oc.column("id").doNothing())
			.executeTakeFirst();
	},

	update: (input: { id: string } & TaskDbUpdateInput) => {
		const { id, ...values } = input;
		const parsedValues = TaskDbUpdateSchema.parse(values);
		const cleanValues = cleanUpdate(parsedValues);

		return db
			.updateTable("tasks")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.where("deleted_at", "is", null)
			.executeTakeFirst();
	},

	// Recoloca um bucket (grupo + categoria): grava a ordem das ids e fixa group_id/category_id.
	// Uma transação só para a lista chegar consistente quando a task muda de grupo/categoria.
	reorder: async (input: { groupId: string | null; categoryId?: string; orderedIds: string[] }) => {
		await db.transaction().execute(async (trx) => {
			for (const [index, id] of input.orderedIds.entries()) {
				await trx
					.updateTable("tasks")
					.set({
						display_order: index,
						group_id: input.groupId,
						// Só recategoriza quando o destino é um cluster de categoria.
						...(input.categoryId ? { category_id: input.categoryId } : {}),
						updated_at: Date.now(),
					})
					.where("id", "=", id)
					.where("deleted_at", "is", null)
					.executeTakeFirst();
			}
		});
	},

	// Soft delete da task + hard delete dos events ligados. O ON DELETE cascade da FK só dispara
	// em hard delete (que tasks nunca fazem), então sem isto os events ficariam órfãos de uma task
	// invisível. Uma transação para a remoção chegar atômica.
	softDelete: async (id: string) => {
		await db.transaction().execute(async (trx) => {
			await trx.deleteFrom("events").where("task_id", "=", id).execute();
			await trx
				.updateTable("tasks")
				.set({
					deleted_at: Date.now(),
					updated_at: Date.now(),
				})
				.where("id", "=", id)
				.where("deleted_at", "is", null)
				.executeTakeFirst();
		});
	},

	getStatsByProject: () =>
		db
			.selectFrom("tasks")
			.select([
				"project_id",
				sql<number>`count(*)`.as("total"),
				sql<number>`sum(case when done = 0 then 1 else 0 end)`.as("pending"),
				sql<number>`sum(case when done = 1 then 1 else 0 end)`.as("done"),
				sql<number | null>`max(updated_at)`.as("last_updated"),
			])
			.where("deleted_at", "is", null)
			.groupBy("project_id")
			.execute(),

	getMetrics: (projectId: string | null) => {
		let query = db
			.selectFrom("tasks")
			.select([
				sql<number>`count(*)`.as("total"),
				sql<number>`sum(case when done = 0 then 1 else 0 end)`.as("pending"),
				sql<number>`sum(case when done = 1 then 1 else 0 end)`.as("done"),
			])
			.where("deleted_at", "is", null);

		if (projectId) {
			query = query.where("project_id", "=", projectId);
		}

		return query.executeTakeFirst();
	},

	getFocusTask: (projectId: string | null) => {
		let query = db
			.selectFrom("tasks")
			.innerJoin("priorities", "priorities.id", "tasks.priority_id")
			.selectAll("tasks")
			.where("tasks.deleted_at", "is", null)
			.where("tasks.done", "=", 0)
			.orderBy("priorities.level", "asc")
			.orderBy("tasks.created_at", "asc")
			.limit(1);

		if (projectId) {
			query = query.where("tasks.project_id", "=", projectId);
		}

		return query.executeTakeFirst();
	},
};
