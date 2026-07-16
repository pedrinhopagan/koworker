import { protectedProcedure } from "../auth/context";
import { dbSkillSettings } from "../db/skill-settings";
import { dbSkillSourcePaths } from "../db/skill-source-paths";
import {
	createSkillInFs,
	deleteAllSkillInFs,
	deleteSkillInFs,
	getSkillFromFs,
	listSkillsFromFs,
	replicateSkillInFs,
	standardizeSkillInFs,
	updateSkillInFs,
} from "../helpers/skills-fs";
import {
	SkillCreateSchema,
	SkillDeleteAllSchema,
	SkillDeleteSchema,
	SkillGetSchema,
	SkillListSchema,
	SkillPathAddSchema,
	SkillPathRemoveSchema,
	SkillReplicateSchema,
	SkillSettingsSchema,
	SkillStandardizeSchema,
	SkillUpdateSchema,
} from "../schemas/skills";

export const skillsRouter = {
	list: protectedProcedure.input(SkillListSchema).handler(async ({ input }) => {
		const [records, settings] = await Promise.all([
			listSkillsFromFs(input.projectName),
			dbSkillSettings.getAll(),
		]);

		const settingsBySlug = new Map(settings.map((row) => [row.slug, row]));

		return records.map((record) => {
			const override = settingsBySlug.get(record.slug);
			return Object.assign(record, {
				settings: {
					label: override?.label ?? null,
					icon: override?.icon ?? null,
					color: override?.color ?? null,
					categoryId: override?.category_id ?? null,
					quickInvoke: !!override?.quick_invoke,
				},
			});
		});
	}),

	get: protectedProcedure.input(SkillGetSchema).handler(async ({ input }) => {
		const record = await getSkillFromFs(input.slug, input.projectName);
		if (!record) return null;

		const override = (await dbSkillSettings.getAll()).find((row) => row.slug === record.slug);
		return Object.assign(record, {
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
		await updateSkillInFs(input);
		return { success: true };
	}),

	standardize: protectedProcedure.input(SkillStandardizeSchema).handler(async ({ input }) => {
		return await standardizeSkillInFs(input);
	}),

	replicate: protectedProcedure.input(SkillReplicateSchema).handler(async ({ input }) => {
		return await replicateSkillInFs(input);
	}),

	delete: protectedProcedure.input(SkillDeleteSchema).handler(async ({ input }) => {
		await deleteSkillInFs(input.path);
		return { success: true };
	}),

	deleteAll: protectedProcedure.input(SkillDeleteAllSchema).handler(async ({ input }) => {
		return await deleteAllSkillInFs(input);
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
