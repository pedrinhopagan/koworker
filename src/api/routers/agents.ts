import { ORPCError } from "@orpc/server";

import { lintPrinciples } from "@/lib/principles/lint";
import { protectedProcedure } from "../auth/context";
import { dbAgentSettings } from "../db/agent-settings";
import { dbAgentSourcePaths } from "../db/agent-source-paths";
import {
	type AgentFsRecord,
	createAgentInFs,
	deleteAllAgentInFs,
	deleteAgentInFs,
	getAgentFromFs,
	injectAgentIntoProject,
	listAgentsFromFs,
	standardizeAgentInFs,
	updateAgentInFs,
} from "../helpers/agents-fs";
import {
	AgentCreateSchema,
	AgentDeleteAllSchema,
	AgentDeleteSchema,
	AgentGetSchema,
	AgentInjectSchema,
	AgentPathAddSchema,
	AgentPathRemoveSchema,
	AgentSettingsSchema,
	AgentStandardizeSchema,
	AgentUpdateSchema,
} from "../schemas/agents";

function agentFindings(record: AgentFsRecord) {
	return lintPrinciples({
		kind: "agent",
		slug: record.slug,
		name: record.name,
		description: record.description,
		body: record.content,
		metadata: record.metadata,
	});
}

export const agentsRouter = {
	list: protectedProcedure.handler(async () => {
		const [records, settings] = await Promise.all([listAgentsFromFs(), dbAgentSettings.getAll()]);

		const settingsBySlug = new Map(settings.map((row) => [row.slug, row]));

		return records.map((record) => {
			const override = settingsBySlug.get(record.slug);
			return {
				slug: record.slug,
				name: record.name,
				description: record.description,
				metadata: record.metadata,
				sources: record.sources,
				conflict: record.conflict,
				primaryPath: record.primaryPath,
				primaryDir: record.primaryDir,
				findings: agentFindings(record),
				settings: {
					label: override?.label ?? null,
					icon: override?.icon ?? null,
					color: override?.color ?? null,
				},
			};
		});
	}),

	get: protectedProcedure.input(AgentGetSchema).handler(async ({ input }) => {
		const record = await getAgentFromFs(input.slug);
		if (!record) return null;

		const override = (await dbAgentSettings.getAll()).find((row) => row.slug === record.slug);
		return Object.assign(record, {
			findings: agentFindings(record),
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

	inject: protectedProcedure.input(AgentInjectSchema).handler(async ({ input }) => {
		return await injectAgentIntoProject(input);
	}),

	delete: protectedProcedure.input(AgentDeleteSchema).handler(async ({ input }) => {
		await deleteAgentInFs(input.path);
		return { success: true };
	}),

	deleteAll: protectedProcedure.input(AgentDeleteAllSchema).handler(async ({ input }) => {
		const result = await deleteAllAgentInFs(input).catch((err: unknown) => {
			throw new ORPCError("CONFLICT", {
				message: err instanceof Error ? err.message : "Não foi possível remover o agent",
				cause: err,
			});
		});
		await dbAgentSettings.remove(input.slug);

		return result;
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
