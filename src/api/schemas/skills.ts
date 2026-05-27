import { z } from "zod";

export const SkillListSchema = z.object({
	projectName: z.string().optional(),
});

export const SkillCreateSchema = z.object({
	slug: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
	description: z.string().min(1),
	content: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export const SkillUpdateSchema = z.object({
	path: z.string().min(1),
	description: z.string().min(1),
	content: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export const SkillDeleteSchema = z.object({
	path: z.string().min(1),
});

export const SkillSettingsSchema = z.object({
	slug: z.string().min(1),
	label: z.string().min(1).optional(),
	icon: z.string().min(1).optional(),
	color: z.string().min(1).optional(),
});

export type SkillCreateInput = z.infer<typeof SkillCreateSchema>;
export type SkillUpdateInput = z.infer<typeof SkillUpdateSchema>;
