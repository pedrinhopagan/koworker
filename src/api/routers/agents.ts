import { protectedProcedure } from "../auth/context";
import { dbAgentSettings } from "../db/agent-settings";
import { dbAgentSourcePaths } from "../db/agent-source-paths";
import {
	createAgentInFs,
	deleteAllAgentInFs,
	deleteAgentInFs,
	getAgentFromFs,
	listAgentsFromFs,
	standardizeAgentInFs,
	updateAgentInFs,
} from "../helpers/agents-fs";
import {
	AgentCreateSchema,
	AgentDeleteAllSchema,
	AgentDeleteSchema,
	AgentGetSchema,
	AgentListSchema,
	AgentPathAddSchema,
	AgentPathRemoveSchema,
	AgentSettingsSchema,
	AgentStandardizeSchema,
	AgentUpdateSchema,
} from "../schemas/agents";

export const agentsRouter = {
	list: protectedProcedure.input(AgentListSchema).handler(async ({ input }) => {
		const [records, settings] = await Promise.all([
			listAgentsFromFs(input.projectName),
			dbAgentSettings.getAll(),
		]);

		const settingsBySlug = new Map(settings.map((row) => [row.slug, row]));

		return records.map((record) => {
			const override = settingsBySlug.get(record.slug);
			return Object.assign(record, {
				settings: {
					label: override?.label ?? null,
					icon: override?.icon ?? null,
					color: override?.color ?? null,
				},
			});
		});
	}),

	get: protectedProcedure.input(AgentGetSchema).handler(async ({ input }) => {
		const record = await getAgentFromFs(input.slug, input.projectName);
		if (!record) return null;

		const override = (await dbAgentSettings.getAll()).find((row) => row.slug === record.slug);
		return Object.assign(record, {
			settings: {
				label: override?.label ?? null,
				icon: override?.icon ?? null,
				color: override?.color ?? null,
			},
		});
	}),

	updateSettings: protectedProcedure.input(AgentSettingsSchema).handler(async ({ input }) => {
		await dbAgentSettings.upsert(input);
		return { success: true };
	}),

	create: protectedProcedure.input(AgentCreateSchema).handler(async ({ input }) => {
		return await createAgentInFs(input);
	}),

	update: protectedProcedure.input(AgentUpdateSchema).handler(async ({ input }) => {
		await updateAgentInFs(input);
		return { success: true };
	}),

	standardize: protectedProcedure.input(AgentStandardizeSchema).handler(async ({ input }) => {
		return await standardizeAgentInFs(input);
	}),

	delete: protectedProcedure.input(AgentDeleteSchema).handler(async ({ input }) => {
		await deleteAgentInFs(input.path);
		return { success: true };
	}),

	deleteAll: protectedProcedure.input(AgentDeleteAllSchema).handler(async ({ input }) => {
		return await deleteAllAgentInFs(input);
	}),

	listPaths: protectedProcedure.handler(async () => {
		return await dbAgentSourcePaths.list();
	}),

	addPath: protectedProcedure.input(AgentPathAddSchema).handler(async ({ input }) => {
		await dbAgentSourcePaths.create(input);
		return { success: true };
	}),

	removePath: protectedProcedure.input(AgentPathRemoveSchema).handler(async ({ input }) => {
		await dbAgentSourcePaths.remove(input.id);
		return { success: true };
	}),
};
