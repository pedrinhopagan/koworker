import { type agent_settings, db } from "./connection";

export type AgentSettingsInput = {
	slug: string;
	label?: string;
	icon?: string;
	color?: string;
};

export const dbAgentSettings = {
	getAll: () => db.selectFrom("agent_settings").selectAll().execute(),

	upsert: ({ slug, label, icon, color }: AgentSettingsInput) => {
		const values = {
			...(label !== undefined && { label }),
			...(icon !== undefined && { icon }),
			...(color !== undefined && { color }),
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
