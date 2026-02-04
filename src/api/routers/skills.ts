import { protectedProcedure } from "../auth/context";
import type { skills } from "../db/connection";
import { dbSkills } from "../db/skills";
import { jsonParse, jsonStringify } from "../helpers/json";
import {
	exportSkillsToConfig,
	importSkillsFromConfig,
	previewExportToConfig,
	previewImportFromConfig,
	syncDefaultSkillsFromStatic,
	syncSkillToConfig,
} from "../helpers/skills-sync";
import {
	SkillCreateSchema,
	SkillIdSchema,
	SkillReorderSchema,
	SkillSyncSchema,
	SkillUpdateSchema,
} from "../schemas/skills";

const mapSkill = (row: skills) => ({
	id: row.id,
	slug: row.slug,
	name: row.name,
	description: row.description,
	content: row.content ?? undefined,
	metadata: jsonParse<Record<string, unknown>>(row.metadata) ?? {},
	source: row.source,
	createdAt: row.created_at,
	updatedAt: row.updated_at ?? undefined,
	displayOrder: row.display_order,
});

export const skillsRouter = {
	list: protectedProcedure.handler(async () => {
		const rows = await dbSkills.getAll();
		return rows.map(mapSkill);
	}),

	getById: protectedProcedure.input(SkillIdSchema).handler(async ({ input }) => {
		const row = await dbSkills.getById(input.id);
		return row ? mapSkill(row) : null;
	}),

	create: protectedProcedure.input(SkillCreateSchema).handler(async ({ input }) => {
		const id = crypto.randomUUID();

		await dbSkills.create({
			id,
			slug: input.slug,
			name: input.name,
			description: input.description,
			content: input.content,
			metadata: jsonStringify(input.metadata ?? {}),
			source: input.source ?? "custom",
		});

		const row = await dbSkills.getById(id);
		if (!row) return null;

		try {
			await syncSkillToConfig(row);
		} catch (error) {
			console.error(`Falha ao sincronizar skill ${input.slug} com a config:`, error);
		}

		return mapSkill(row);
	}),

	update: protectedProcedure.input(SkillUpdateSchema).handler(async ({ input }) => {
		const { id, metadata, ...rest } = input;

		await dbSkills.update({
			id,
			...rest,
			metadata: metadata ? jsonStringify(metadata) : undefined,
		});

		const row = await dbSkills.getById(id);
		if (!row) return null;

		try {
			await syncSkillToConfig(row);
		} catch (error) {
			console.error(`Falha ao sincronizar skill ${row.slug} com a config:`, error);
		}

		return mapSkill(row);
	}),

	delete: protectedProcedure.input(SkillIdSchema).handler(async ({ input }) => {
		const row = await dbSkills.getById(input.id);
		if (!row) return { success: false };

		await dbSkills.delete(input.id);

		return { success: true };
	}),

	reorder: protectedProcedure.input(SkillReorderSchema).handler(async ({ input }) => {
		await dbSkills.reorder(input.orderedIds);
		return { success: true };
	}),

	previewImportFromConfig: protectedProcedure.handler(async () => {
		return await previewImportFromConfig();
	}),

	previewExportToConfig: protectedProcedure.handler(async () => {
		return await previewExportToConfig();
	}),

	importFromConfig: protectedProcedure.input(SkillSyncSchema).handler(async ({ input }) => {
		return await importSkillsFromConfig(input);
	}),

	exportToConfig: protectedProcedure.input(SkillSyncSchema).handler(async ({ input }) => {
		return await exportSkillsToConfig(input);
	}),

	syncDefaultsFromStatic: protectedProcedure.handler(async () => {
		return await syncDefaultSkillsFromStatic();
	}),
};
