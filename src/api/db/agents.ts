import type { AgentDbCreateInput, AgentDbUpdateInput } from "../schemas/agents";
import { type agents, db } from "./connection";
import { cleanUpdate } from "./helpers";

export const dbAgents = {
	getAll: () => db.selectFrom("agents").selectAll().orderBy("display_order", "asc").execute(),

	getById: (id: string) =>
		db.selectFrom("agents").selectAll().where("id", "=", id).executeTakeFirst(),

	create: async (input: AgentDbCreateInput) => {
		const maxOrder = await db
			.selectFrom("agents")
			.select(({ fn }) => [fn.max("display_order").as("maxOrder")])
			.executeTakeFirst();

		const displayOrder = ((maxOrder?.maxOrder as number | null) ?? -1) + 1;

		return db
			.insertInto("agents")
			.values({ ...(input as agents), display_order: displayOrder })
			.executeTakeFirst();
	},

	update: (input: { id: string } & AgentDbUpdateInput) => {
		const { id, ...values } = input;
		const cleanValues = cleanUpdate(values);

		return db
			.updateTable("agents")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.executeTakeFirst();
	},

	delete: (id: string) => db.deleteFrom("agents").where("id", "=", id).executeTakeFirst(),

	reorder: async (orderedIds: string[]) => {
		await db.transaction().execute(async (trx) => {
			for (const [index, id] of orderedIds.entries()) {
				await trx
					.updateTable("agents")
					.set({ display_order: index, updated_at: Date.now() })
					.where("id", "=", id)
					.executeTakeFirst();
			}
		});
	},
};
