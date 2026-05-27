import { db, type skill_settings } from "./connection";

export type SkillSettingsInput = {
	slug: string;
	label?: string;
	icon?: string;
	color?: string;
};

export const dbSkillSettings = {
	getAll: () => db.selectFrom("skill_settings").selectAll().execute(),

	upsert: ({ slug, label, icon, color }: SkillSettingsInput) => {
		const values = {
			...(label !== undefined && { label }),
			...(icon !== undefined && { icon }),
			...(color !== undefined && { color }),
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
