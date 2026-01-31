import type { ProjectDbCreateInput, ProjectDbUpdateInput } from "../schemas/projects";
import { db, type projects } from "./connection";
import { cleanUpdate } from "./helpers";

export const dbProjects = {
	getAll: () =>
		db
			.selectFrom("projects")
			.selectAll()
			.where("deleted_at", "is", null)
			.orderBy("display_order", "asc")
			.execute(),

	getById: (id: string) =>
		db
			.selectFrom("projects")
			.selectAll()
			.where("id", "=", id)
			.where("deleted_at", "is", null)
			.executeTakeFirst(),

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
