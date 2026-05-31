import { sql } from "kysely";

import type {
	ProjectRouteDbCreateInput,
	ProjectRouteDbUpdateInput,
} from "../schemas/project-routes";
import { type project_routes, db } from "./connection";
import { cleanUpdate } from "./helpers";

export const dbProjectRoutes = {
	getByProject: (projectId: string) =>
		db
			.selectFrom("project_routes")
			.selectAll()
			.where("project_id", "=", projectId)
			.orderBy("display_order", "asc")
			.execute(),

	getById: (id: string) =>
		db.selectFrom("project_routes").selectAll().where("id", "=", id).executeTakeFirst(),

	create: async (input: ProjectRouteDbCreateInput) => {
		const existingWithSameName = await db
			.selectFrom("project_routes")
			.selectAll()
			.where("project_id", "=", input.project_id)
			.where("name", "=", input.name)
			.executeTakeFirst();

		if (existingWithSameName) {
			throw new Error("Já existe uma rota com este nome neste projeto");
		}

		const maxOrder = await db
			.selectFrom("project_routes")
			.select(({ fn }) => [fn.max("display_order").as("maxOrder")])
			.where("project_id", "=", input.project_id)
			.executeTakeFirst();

		const displayOrder = ((maxOrder?.maxOrder as number | null) ?? -1) + 1;

		return db
			.insertInto("project_routes")
			.values({ ...(input as project_routes), display_order: displayOrder })
			.executeTakeFirst();
	},

	update: async (input: { id: string } & ProjectRouteDbUpdateInput) => {
		const { id, ...values } = input;

		if (values.name) {
			const currentRoute = await db
				.selectFrom("project_routes")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirst();

			if (currentRoute) {
				const existingWithSameName = await db
					.selectFrom("project_routes")
					.selectAll()
					.where("project_id", "=", currentRoute.project_id)
					.where("name", "=", values.name)
					.where("id", "!=", id)
					.executeTakeFirst();

				if (existingWithSameName) {
					throw new Error("Já existe uma rota com este nome neste projeto");
				}
			}
		}

		const cleanValues = cleanUpdate(values);

		return db
			.updateTable("project_routes")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.executeTakeFirst();
	},

	rewritePrefix: (input: { projectId: string; oldPrefix: string; newPrefix: string }) => {
		const { projectId, oldPrefix, newPrefix } = input;
		const len = oldPrefix.length;

		return db
			.updateTable("project_routes")
			.set({
				route: sql<string>`${newPrefix} || substr(route, ${len + 1})`,
				updated_at: Date.now(),
			})
			.where("project_id", "=", projectId)
			.where(sql<boolean>`substr(route, 1, ${len}) = ${oldPrefix}`)
			.where(sql<boolean>`(length(route) = ${len} or substr(route, ${len + 1}, 1) = '/')`)
			.executeTakeFirst();
	},

	delete: (id: string) => db.deleteFrom("project_routes").where("id", "=", id).executeTakeFirst(),

	reorder: async (orderedIds: string[]) => {
		await db.transaction().execute(async (trx) => {
			for (const [index, id] of orderedIds.entries()) {
				await trx
					.updateTable("project_routes")
					.set({ display_order: index, updated_at: Date.now() })
					.where("id", "=", id)
					.executeTakeFirst();
			}
		});
	},
};
