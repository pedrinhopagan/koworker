import { sql } from "kysely";

import type { ProjectDbCreateInput, ProjectDbUpdateInput } from "../schemas/projects";
import { db, type projects } from "./connection";
import { cleanUpdate } from "./helpers";

export const dbProjects = {
	getAll: async () => {
		const projects = await db
			.selectFrom("projects")
			.selectAll()
			.where("deleted_at", "is", null)
			.orderBy("display_order", "asc")
			.execute();

		const projectsWithRoutes = await Promise.all(
			projects.map(async (project) => {
				const routes = await db
					.selectFrom("project_routes")
					.selectAll()
					.where("project_id", "=", project.id)
					.orderBy("display_order", "asc")
					.execute();

				return Object.assign({}, project, { routes });
			}),
		);

		return projectsWithRoutes;
	},

	getById: async (id: string) => {
		const project = await db
			.selectFrom("projects")
			.selectAll()
			.where("id", "=", id)
			.where("deleted_at", "is", null)
			.executeTakeFirst();

		if (!project) return null;

		const routes = await db
			.selectFrom("project_routes")
			.selectAll()
			.where("project_id", "=", id)
			.orderBy("display_order", "asc")
			.execute();

		return Object.assign({}, project, { routes });
	},

	getByIdWithSummary: async (id: string) => {
		const project = await db
			.selectFrom("projects")
			.leftJoin("tasks", (join) =>
				join.onRef("tasks.project_id", "=", "projects.id").on("tasks.deleted_at", "is", null),
			)
			.selectAll("projects")
			.select([
				sql<number>`count(tasks.id)`.as("tasks_total"),
				sql<number>`sum(case when tasks.done = 1 then 1 else 0 end)`.as("tasks_done"),
				sql<number>`sum(case when tasks.done = 0 then 1 else 0 end)`.as("tasks_pending"),
			])
			.where("projects.id", "=", id)
			.where("projects.deleted_at", "is", null)
			.groupBy("projects.id")
			.executeTakeFirst();

		if (!project) return null;

		const routes = await db
			.selectFrom("project_routes")
			.selectAll()
			.where("project_id", "=", id)
			.orderBy("display_order", "asc")
			.execute();

		return Object.assign({}, project, { routes });
	},

	create: async (input: ProjectDbCreateInput) => {
		const maxOrder = await db
			.selectFrom("projects")
			.select(({ fn }) => [fn.max("display_order").as("maxOrder")])
			.where("deleted_at", "is", null)
			.executeTakeFirst();

		const displayOrder = ((maxOrder?.maxOrder as number | null) ?? -1) + 1;

		return db
			.insertInto("projects")
			.values({ ...(input as projects), display_order: displayOrder })
			.executeTakeFirst();
	},

	update: (input: { id: string } & ProjectDbUpdateInput) => {
		const { id, ...values } = input;
		const cleanValues = cleanUpdate(values);

		return db
			.updateTable("projects")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.where("deleted_at", "is", null)
			.executeTakeFirst();
	},

	softDelete: (id: string) =>
		db
			.updateTable("projects")
			.set({
				deleted_at: Date.now(),
				updated_at: Date.now(),
			})
			.where("id", "=", id)
			.where("deleted_at", "is", null)
			.executeTakeFirst(),

	reorder: async (orderedIds: string[]) => {
		await db.transaction().execute(async (trx) => {
			for (const [index, id] of orderedIds.entries()) {
				await trx
					.updateTable("projects")
					.set({ display_order: index, updated_at: Date.now() })
					.where("id", "=", id)
					.where("deleted_at", "is", null)
					.executeTakeFirst();
			}
		});
	},
};
