import { z } from "zod";

export const SkillIdSchema = z.object({
	id: z.string().uuid(),
});

export const SkillSlugSchema = z.object({
	slug: z.string(),
});

export const SkillDbCreateSchema = z.object({
	id: z.string().uuid(),
	slug: z.string(),
	name: z.string(),
	description: z.string(),
	content: z.string().optional(),
	metadata: z.string().optional(),
	source: z.enum(["builtin", "custom"]).default("custom"),
});

export const SkillDbUpdateSchema = SkillDbCreateSchema.omit({ id: true, slug: true }).partial();

export type SkillDbCreateInput = z.infer<typeof SkillDbCreateSchema>;
export type SkillDbUpdateInput = z.infer<typeof SkillDbUpdateSchema>;

export const SkillCreateSchema = z.object({
	slug: z.string(),
	name: z.string(),
	description: z.string(),
	content: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	source: z.enum(["builtin", "custom"]).default("custom"),
});

export const SkillUpdateSchema = z.object({
	id: z.string().uuid(),
	name: z.string().optional(),
	description: z.string().optional(),
	content: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	source: z.enum(["builtin", "custom"]).optional(),
});

export const SkillReorderSchema = z.object({
	orderedIds: z.array(z.string().uuid()).min(1),
});

export const SkillConflictStrategySchema = z.enum(["overwrite", "ignore"]);

export const SkillSyncSchema = z.object({
	slugs: z.array(z.string()).optional(),
	conflictStrategy: SkillConflictStrategySchema.default("ignore"),
});

export type SkillCreateInput = z.infer<typeof SkillCreateSchema>;
export type SkillUpdateInput = z.infer<typeof SkillUpdateSchema>;
export type SkillSyncInput = z.infer<typeof SkillSyncSchema>;
