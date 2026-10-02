import type {
	AgentCategoryDbCreateInput,
	AgentCategoryDbUpdateInput,
} from "../schemas/agent-categories";
import { db, type agent_categories } from "./connection";
import { normalizeEntityName } from "./entity-name";
import { cleanUpdate } from "./helpers";

export const dbAgentCategories = {
	getAll: () =>
		db.selectFrom("agent_categories").selectAll().orderBy("display_order", "asc").execute(),

	getById: (id: string) =>
		db.selectFrom("agent_categories").selectAll().where("id", "=", id).executeTakeFirst(),

	create: async (input: AgentCategoryDbCreateInput) => {
		const maxOrder = await db
			.selectFrom("agent_categories")
			.select(({ fn }) => [fn.max("display_order").as("maxOrder")])
			.executeTakeFirst();

		const displayOrder = ((maxOrder?.maxOrder as number | null) ?? -1) + 1;

		return db
			.insertInto("agent_categories")
			.values({ ...(input as agent_categories), display_order: displayOrder })
			.executeTakeFirst();
	},

	update: (input: { id: string } & AgentCategoryDbUpdateInput) => {
		const { id, ...values } = input;
		const cleanValues = cleanUpdate(values);

		return db
			.updateTable("agent_categories")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.executeTakeFirst();
	},

	// Os agents da categoria voltam pra "Sem categoria": em bancos novos a FK SET NULL faz isso,
	// mas bancos migrados não têm a FK (ALTER não a anexa), então soltamos os agents à mão.
	delete: async (id: string) => {
		await db
			.updateTable("agent_settings")
			.set({ category_id: null })
			.where("category_id", "=", id)
			.execute();
		return db.deleteFrom("agent_categories").where("id", "=", id).executeTakeFirst();
	},

	findByNormalizedName: async (name: string, excludeId?: string) => {
		const rows = await db.selectFrom("agent_categories").selectAll().execute();
		const normalized = normalizeEntityName(name);

		return (
			rows.find((row) => {
				if (excludeId && row.id === excludeId) return false;
				return normalizeEntityName(row.name) === normalized;
			}) ?? null
		);
	},
};
