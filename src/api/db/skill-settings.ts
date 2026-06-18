import { db, type skill_settings } from "./connection";

export type SkillSettingsInput = {
	slug: string;
	label?: string;
	icon?: string;
	color?: string;
	categoryId?: string | null;
	quickInvoke?: boolean;
};

export const dbSkillSettings = {
	getAll: () => db.selectFrom("skill_settings").selectAll().execute(),

	upsert: ({ slug, label, icon, color, categoryId, quickInvoke }: SkillSettingsInput) => {
		const values = {
			...(label !== undefined && { label }),
			...(icon !== undefined && { icon }),
			...(color !== undefined && { color }),
			...(categoryId !== undefined && { category_id: categoryId }),
			...(quickInvoke !== undefined && { quick_invoke: quickInvoke ? 1 : 0 }),
		};

		return db
			.insertInto("skill_settings")
			.values({ slug, ...values } as skill_settings)
			.onConflict((oc) =>
				oc
					.column("slug")
					.doUpdateSet({ ...values, updated_at: Date.now() } as Partial<skill_settings>),
			)
			.executeTakeFirst();
	},
};
