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

	if (filters.groupId !== undefined) {
		query = filters.groupId
			? query.where("group_id", "=", filters.groupId)
			: query.where("group_id", "is", null);
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

	getByFolderPath: (input: { projectId: string; folderPath: string }) =>
		db
			.selectFrom("tasks as t")
			.selectAll("t")
			.where("t.project_id", "=", input.projectId)
			.where("t.folder_path", "=", input.folderPath)
			.where("t.deleted_at", "is", null)
			.executeTakeFirst(),

	getByStorageKey: (storageKey: string) =>
		db
			.selectFrom("tasks as t")
			.selectAll("t")
			.where("t.storage_key", "=", storageKey)
			.where("t.deleted_at", "is", null)
			.executeTakeFirst(),

	// O índice que casa uma conversa antiga de CLI com as tarefas que ela tocou: a pasta citada no
	// transcript e o worktree onde o agente rodou. Vale para todos os projetos porque o histórico é
	// filtrado depois, pelo diretório da sessão.
	listPathIndex: () =>
		db
			.selectFrom("tasks as t")
			.select(["t.id", "t.project_id", "t.title", "t.folder_path", "t.worktree_path"])
			.where("t.deleted_at", "is", null)
			.execute(),

	listLinkTargets: () =>
		db
			.selectFrom("tasks as t")
			.innerJoin("projects as p", "p.id", "t.project_id")
			.select(["t.id", "t.group_id", "t.folder_path", "t.worktree_path", "p.main_route"])
			.where("t.deleted_at", "is", null)
			.where("p.deleted_at", "is", null)
			.execute(),

	listStorageKeys: () =>
		db
			.selectFrom("tasks as t")
			.select("t.storage_key")
			.where("t.storage_key", "is not", null)
			.execute(),

	listByProject: (input: { projectId: string } & TaskListFiltersInput) => {
		let query = db.selectFrom("tasks").selectAll().where("deleted_at", "is", null);

		query = applyTaskListFilters(query, input);
		return query.execute();
	},

	listFolderPathsByProjectIds: (projectIds: string[]) =>
		db
			.selectFrom("tasks as t")
			.select(["t.project_id", "t.folder_path"])
			.where("t.project_id", "in", projectIds)
			.execute(),

	listFolderPathsByProject: (projectId: string) =>
		db
			.selectFrom("tasks as t")
			.selectAll("t")
			.where("t.project_id", "=", projectId)
			.where("t.deleted_at", "is", null)
			.execute(),

	listStorageByProject: (projectId: string) =>
		db
			.selectFrom("tasks as t")
			.leftJoin("task_groups as tg", "tg.id", "t.group_id")
			.select([
				"t.id",
				"t.project_id",
				"t.folder_path",
				"t.storage_key",
				"t.storage_slug",
				"t.title",
				"t.group_id",
				"t.deleted_at",
				"tg.project_id as group_project_id",
				"tg.storage_key as group_storage_key",
				"tg.storage_slug as group_storage_slug",
			])
			.where("t.project_id", "=", projectId)
			.orderBy("t.created_at", "asc")
			.orderBy("t.id", "asc")
			.execute(),

	listLivePathDuplicates: (projectId: string) =>
		db
			.selectFrom("tasks as t")
			.select(["t.folder_path"])
			.select(({ fn }) => fn.count<number>("t.id").as("count"))
			.where("t.project_id", "=", projectId)
			.where("t.deleted_at", "is", null)
			.groupBy("t.folder_path")
			.having(({ fn }) => fn.count("t.id"), ">", 1)
			.execute(),

	createMany: async (inputs: TaskDbCreateInput[]) => {
		const rows = inputs.map((input) => TaskDbCreateSchema.parse(input));

		await db
			.insertInto("tasks")
			.values(
				rows.map(
					(row) => Object.assign(row, { created_at: row.created_at ?? Date.now() }) as tasks,
				),
			)
			.onConflict((oc) => oc.column("id").doNothing())
			.execute();
	},

	getAll: (
		input: {
			projectId?: string | null;
			includeCompleted?: boolean;
			limit?: number;
			offset?: number;
		} & TaskListFiltersInput,
	) => {
		let query = db.selectFrom("tasks").selectAll().where("deleted_at", "is", null);

		// Exclude completed tasks by default.
		if (!input.includeCompleted) {
			query = query.where("done", "=", 0);
		}

		query = applyTaskListFilters(query, input);
		query = query
			.orderBy("display_order", "asc")
			.orderBy("created_at", "desc")
			.orderBy("id", "asc")
			.limit(input.limit ?? 50)
			.offset(input.offset ?? 0);
		return query.execute();
	},

	listForCli: (
		input: {
			id?: string;
			projectId?: string | null;
			includeCompleted?: boolean;
			done?: boolean;
		} & TaskListFiltersInput,
	) => {
		let query = db
			.selectFrom("tasks as t")
			.innerJoin("projects as p", "p.id", "t.project_id")
			.select([
				"t.id as id",
				"t.project_id as project_id",
				"t.folder_path as folder_path",
				"t.title as title",
				"t.file_order as file_order",
				"t.done as done",
				"t.completed_at as completed_at",
				"t.created_at as created_at",
				"t.updated_at as updated_at",
				"p.name as project_name",
				"p.main_route as project_main_route",
			])
			.where("t.deleted_at", "is", null)
			.where("p.deleted_at", "is", null);

		if (input.id) {
			query = query.where("t.id", "=", input.id);
		}

		if (input.projectId) {
			query = query.where("t.project_id", "=", input.projectId);
		}

		if (input.q) {
			const term = `%${input.q.trim()}%`;
			query = query.where((eb) =>
				eb.or([eb("t.title", "like", term), eb("t.folder_path", "like", term)]),
			);
		}

		if (input.done !== undefined) {
			query = query.where("t.done", "=", input.done ? 1 : 0);
		} else if (!input.includeCompleted) {
			query = query.where("t.done", "=", 0);
		}

		return query.orderBy("p.display_order", "asc").orderBy("t.display_order", "asc").execute();
	},

	create: (input: TaskDbCreateInput) => {
		const parsed = TaskDbCreateSchema.parse(input);
		return db
			.insertInto("tasks")
			.values({ ...(parsed as tasks), created_at: parsed.created_at ?? Date.now() })
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

	ignoreRecency: (input: { id: string; createdAt: number; updatedAt: number }) =>
		db
			.updateTable("tasks")
			.set({ created_at: input.createdAt, updated_at: input.updatedAt })
			.where("id", "=", input.id)
			.where("deleted_at", "is", null)
			.execute(),

	reorder: async (input: { groupId: string | null; orderedIds: string[] }) => {
		await db.transaction().execute(async (trx) => {
			for (const [index, id] of input.orderedIds.entries()) {
				await trx
					.updateTable("tasks")
					.set({
						display_order: index,
						group_id: input.groupId,
						updated_at: Date.now(),
					})
					.where("id", "=", id)
					.where("deleted_at", "is", null)
					.executeTakeFirst();
			}
		});
	},

	softDelete: (id: string) =>
		db
			.updateTable("tasks")
			.set({
				deleted_at: Date.now(),
				updated_at: Date.now(),
			})
			.where("id", "=", id)
			.where("deleted_at", "is", null)
			.executeTakeFirst(),

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
			.selectAll("tasks")
			.where("tasks.deleted_at", "is", null)
			.where("tasks.done", "=", 0)
			.orderBy("tasks.created_at", "asc")
			.limit(1);

		if (projectId) {
			query = query.where("tasks.project_id", "=", projectId);
		}

		return query.executeTakeFirst();
	},
};
