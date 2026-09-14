import { type agent_settings, db } from "./connection";

export type AgentSettingsInput = {
	slug: string;
	label?: string;
	icon?: string;
	color?: string;
	categoryId?: string | null;
};

export const dbAgentSettings = {
	getAll: () => db.selectFrom("agent_settings").selectAll().execute(),
	remove: (slug: string) =>
		db.deleteFrom("agent_settings").where("slug", "=", slug).executeTakeFirst(),

	upsert: ({ slug, label, icon, color, categoryId }: AgentSettingsInput) => {
		const values = {
			...(label !== undefined && { label }),
			...(icon !== undefined && { icon }),
			...(color !== undefined && { color }),
			...(categoryId !== undefined && { category_id: categoryId }),
		};

		return db
			.insertInto("agent_settings")
			.values({ slug, ...values } as agent_settings)
			.onConflict((oc) =>
				oc
					.column("slug")
					.doUpdateSet({ ...values, updated_at: Date.now() } as Partial<agent_settings>),
			)
			.executeTakeFirst();
	},
};
