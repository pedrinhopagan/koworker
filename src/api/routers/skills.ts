import { protectedProcedure } from "../auth/context";
import { dbSkillSettings } from "../db/skill-settings";
import {
	createSkillInFs,
	deleteSkillInFs,
	listSkillsFromFs,
	updateSkillInFs,
} from "../helpers/skills-fs";
import {
	SkillCreateSchema,
	SkillDeleteSchema,
	SkillListSchema,
	SkillSettingsSchema,
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
				},
			});
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

	delete: protectedProcedure.input(SkillDeleteSchema).handler(async ({ input }) => {
		await deleteSkillInFs(input.path);
		return { success: true };
	}),
};
