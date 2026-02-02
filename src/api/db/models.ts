import type { ModelDbCreateInput, ModelDbUpdateInput } from "../schemas/models";
import { db, type models } from "./connection";
import { cleanUpdate } from "./helpers";

export const dbModels = {
	getAll: () => db.selectFrom("models").selectAll().orderBy("display_order", "asc").execute(),

	getById: (id: string) =>
		db.selectFrom("models").selectAll().where("id", "=", id).executeTakeFirst(),

	create: async (input: ModelDbCreateInput) => {
		const maxOrder = await db
			.selectFrom("models")
			.select(({ fn }) => [fn.max("display_order").as("maxOrder")])
			.executeTakeFirst();

		const displayOrder = ((maxOrder?.maxOrder as number | null) ?? -1) + 1;

		return db
			.insertInto("models")
			.values({ ...(input as models), display_order: displayOrder })
			.executeTakeFirst();
	},

	update: (input: { id: string } & ModelDbUpdateInput) => {
		const { id, ...values } = input;
		const cleanValues = cleanUpdate(values);

		return db
			.updateTable("models")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.executeTakeFirst();
	},

	delete: (id: string) => db.deleteFrom("models").where("id", "=", id).executeTakeFirst(),

	reorder: async (orderedIds: string[]) => {
		await db.transaction().execute(async (trx) => {
			for (const [index, id] of orderedIds.entries()) {
				await trx
					.updateTable("models")
					.set({ display_order: index, updated_at: Date.now() })
					.where("id", "=", id)
					.executeTakeFirst();
			}
		});
	},
};
