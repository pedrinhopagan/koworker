import type {
	SkillCategoryDbCreateInput,
	SkillCategoryDbUpdateInput,
} from "../schemas/skill-categories";
import { db, type skill_categories } from "./connection";
import { normalizeEntityName } from "./entity-name";
import { cleanUpdate } from "./helpers";

export const dbSkillCategories = {
	getAll: () =>
		db.selectFrom("skill_categories").selectAll().orderBy("display_order", "asc").execute(),

	getById: (id: string) =>
		db.selectFrom("skill_categories").selectAll().where("id", "=", id).executeTakeFirst(),

	create: async (input: SkillCategoryDbCreateInput) => {
		const maxOrder = await db
			.selectFrom("skill_categories")
			.select(({ fn }) => [fn.max("display_order").as("maxOrder")])
			.executeTakeFirst();

		const displayOrder = ((maxOrder?.maxOrder as number | null) ?? -1) + 1;

		return db
			.insertInto("skill_categories")
			.values({ ...(input as skill_categories), display_order: displayOrder })
			.executeTakeFirst();
	},

	update: (input: { id: string } & SkillCategoryDbUpdateInput) => {
		const { id, ...values } = input;
		const cleanValues = cleanUpdate(values);

		return db
			.updateTable("skill_categories")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.executeTakeFirst();
	},

	// As skills da categoria voltam pra "Sem categoria": em bancos novos a FK SET NULL faz isso,
	// mas bancos migrados não têm a FK (ALTER não a anexa), então soltamos as skills à mão.
	delete: async (id: string) => {
		await db
			.updateTable("skill_settings")
			.set({ category_id: null })
			.where("category_id", "=", id)
			.execute();
		return db.deleteFrom("skill_categories").where("id", "=", id).executeTakeFirst();
	},

	findByNormalizedName: async (name: string, excludeId?: string) => {
		const rows = await db.selectFrom("skill_categories").selectAll().execute();
		const normalized = normalizeEntityName(name);

		return (
			rows.find((row) => {
				if (excludeId && row.id === excludeId) return false;
				return normalizeEntityName(row.name) === normalized;
			}) ?? null
		);
	},
};
