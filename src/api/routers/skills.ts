import { ORPCError } from "@orpc/server";
import { lintPrinciples } from "@/lib/principles/lint";
import { protectedProcedure } from "../auth/context";
import { dbSkillSettings } from "../db/skill-settings";
import { dbSkillSourcePaths } from "../db/skill-source-paths";
import {
	createSkillInFs,
	deleteAllSkillInFs,
	deleteSkillInFs,
	exportSkillTextFromFs,
	getSkillFromFs,
	listSkillsFromFs,
	previewSkillStandardizationInFs,
	readSkillFileFromFs,
	type SkillFsRecord,
	renameSkillInFs,
	standardizeSkillInFs,
	updateSkillInFs,
} from "../helpers/skills-fs";
import { applySkillSyncInFs, previewSkillSyncInFs } from "../helpers/skills-sync";
import {
	SkillCreateSchema,
	SkillDeleteAllSchema,
	SkillDeleteSchema,
	SkillGetSchema,
	SkillFileReadSchema,
	SkillListSchema,
	SkillPathAddSchema,
	SkillPathRemoveSchema,
	SkillRenameSchema,
	SkillSettingsSchema,
	SkillStandardizeSchema,
	SkillStandardizePreviewSchema,
	SkillSyncSchema,
	SkillTextExportSchema,
	SkillUpdateSchema,
} from "../schemas/skills";

function skillFindings(record: SkillFsRecord) {
	return lintPrinciples({
		kind: "skill",
		slug: record.slug,
		name: record.name,
		description: record.description,
		body: record.content,
		metadata: record.metadata,
	});
}

export const skillsRouter = {
	list: protectedProcedure.input(SkillListSchema).handler(async ({ input }) => {
		const [records, settings] = await Promise.all([
			listSkillsFromFs(input.projectName),
			dbSkillSettings.getAll(),
		]);

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
				findings: skillFindings(record),
				settings: {
					label: override?.label ?? null,
					icon: override?.icon ?? null,
					color: override?.color ?? null,
					categoryId: override?.category_id ?? null,
					quickInvoke: !!override?.quick_invoke,
				},
			};
		});
	}),

	get: protectedProcedure.input(SkillGetSchema).handler(async ({ input }) => {
		const record = await getSkillFromFs(input.slug, input.projectName);
		if (!record) return null;

		const override = (await dbSkillSettings.getAll()).find((row) => row.slug === record.slug);
		return Object.assign(record, {
			findings: skillFindings(record),
			settings: {
				label: override?.label ?? null,
				icon: override?.icon ?? null,
				color: override?.color ?? null,
				categoryId: override?.category_id ?? null,
				quickInvoke: !!override?.quick_invoke,
			},
		});
	}),

	updateSettings: protectedProcedure.input(SkillSettingsSchema).handler(async ({ input }) => {
		await dbSkillSettings.upsert(input);
		return { success: true };
	}),

	create: protectedProcedure.input(SkillCreateSchema).handler(async ({ input }) => {
		return await createSkillInFs(input);
	}),

	update: protectedProcedure.input(SkillUpdateSchema).handler(async ({ input }) => {
		return await updateSkillInFs(input);
	}),

	rename: protectedProcedure.input(SkillRenameSchema).handler(async ({ input }) => {
		const renamed = await renameSkillInFs(input);
		try {
			await dbSkillSettings.rename(input.slug, input.newSlug);
		} catch (err) {
			await renameSkillInFs({
				slug: input.newSlug,
				newSlug: input.slug,
				projectName: input.projectName,
			});
			throw err;
		}

		return renamed;
	}),

	readFile: protectedProcedure.input(SkillFileReadSchema).handler(async ({ input }) => {
		return await readSkillFileFromFs(input);
	}),

	exportText: protectedProcedure.input(SkillTextExportSchema).handler(async ({ input }) => {
		return await exportSkillTextFromFs(input);
	}),

	standardizePreview: protectedProcedure
		.input(SkillStandardizePreviewSchema)
		.handler(async ({ input }) => {
			return await previewSkillStandardizationInFs(input);
		}),

	standardize: protectedProcedure
		.input(SkillStandardizeSchema)
		.errors({ CONFLICT: {} })
		.handler(async ({ input }) => {
			return await standardizeSkillInFs(input);
		}),

	syncPlan: protectedProcedure.handler(() => previewSkillSyncInFs()),

	sync: protectedProcedure.input(SkillSyncSchema).handler(({ input }) => applySkillSyncInFs(input)),

	delete: protectedProcedure.input(SkillDeleteSchema).handler(async ({ input }) => {
		await deleteSkillInFs(input);
		return { success: true };
	}),

	deleteAll: protectedProcedure.input(SkillDeleteAllSchema).handler(async ({ input }) => {
		const result = await deleteAllSkillInFs(input).catch((err: any) => {
			throw new ORPCError("CONFLICT", {
				message: err instanceof Error ? err.message : "Não foi possível remover a skill",
				cause: err,
			});
		});
		await dbSkillSettings.remove(input.slug);
		return result;
	}),

	listPaths: protectedProcedure.handler(async () => {
		return await dbSkillSourcePaths.list();
	}),

	addPath: protectedProcedure.input(SkillPathAddSchema).handler(async ({ input }) => {
		await dbSkillSourcePaths.create(input);
		return { success: true };
	}),

	removePath: protectedProcedure.input(SkillPathRemoveSchema).handler(async ({ input }) => {
		await dbSkillSourcePaths.remove(input.id);
		return { success: true };
	}),
};
