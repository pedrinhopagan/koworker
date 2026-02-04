import type { SkillDbCreateInput, SkillDbUpdateInput } from "../schemas/skills";
import { db, type skills } from "./connection";
import { cleanUpdate } from "./helpers";

export const dbSkills = {
	getAll: () =>
		db
			.selectFrom("skills")
			.selectAll()
			.orderBy("source", "asc")
			.orderBy("display_order", "asc")
			.orderBy("name", "asc")
			.execute(),

	getById: (id: string) =>
		db.selectFrom("skills").selectAll().where("id", "=", id).executeTakeFirst(),

	getBySlug: (slug: string) =>
		db.selectFrom("skills").selectAll().where("slug", "=", slug).executeTakeFirst(),

	create: async (input: SkillDbCreateInput) => {
		const source = input.source ?? "custom";
		const maxOrder = await db
			.selectFrom("skills")
			.select(({ fn }) => [fn.max("display_order").as("maxOrder")])
			.where("source", "=", source)
			.executeTakeFirst();
		const displayOrder = ((maxOrder?.maxOrder as number | null) ?? -1) + 1;

		return db
			.insertInto("skills")
			.values({ ...(input as skills), display_order: displayOrder })
			.onConflict((oc) => oc.column("id").doNothing())
			.executeTakeFirst();
	},

	update: (input: { id: string } & SkillDbUpdateInput) => {
		const { id, ...values } = input;
		const cleanValues = cleanUpdate(values);

		return db
			.updateTable("skills")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.executeTakeFirst();
	},

	delete: (id: string) => db.deleteFrom("skills").where("id", "=", id).executeTakeFirst(),

	deleteBySlug: (slug: string) =>
		db.deleteFrom("skills").where("slug", "=", slug).executeTakeFirst(),

	deleteAll: () => db.deleteFrom("skills").execute(),

	deleteBySource: (source: "builtin" | "custom") =>
		db.deleteFrom("skills").where("source", "=", source).execute(),

	reorder: async (orderedIds: string[]) => {
		await db.transaction().execute(async (trx) => {
			for (const [index, id] of orderedIds.entries()) {
				await trx
					.updateTable("skills")
					.set({ display_order: index, updated_at: Date.now() })
					.where("id", "=", id)
					.executeTakeFirst();
			}
		});
	},
};
