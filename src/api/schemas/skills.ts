import { z } from "zod";
import { SKILL_SLUG_PATTERN } from "@/constants/skill-slug";

const SkillSlugSchema = z
	.string()
	.min(1)
	.regex(SKILL_SLUG_PATTERN, "Slug deve conter apenas letras minúsculas, números e hífens");

export const SkillListSchema = z.object({
	projectName: z.string().optional(),
});

export const SkillCreateSchema = z.object({
	slug: SkillSlugSchema,
	description: z.string().min(1),
	content: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export const SkillVariantTargetSchema = z.object({
	slug: SkillSlugSchema,
	projectName: z.string().optional(),
	variantPath: z.string().min(1),
});

export const SkillUpdateSchema = SkillVariantTargetSchema.extend({
	description: z.string().min(1),
	content: z.string(),
	metadata: z.record(z.string(), z.unknown()),
	expectedSkillHash: z.string().min(1),
});

export const SkillGetSchema = z.object({
	slug: SkillSlugSchema,
	projectName: z.string().optional(),
});

export const SkillRenameSchema = z.object({
	slug: SkillSlugSchema,
	newSlug: SkillSlugSchema,
	projectName: z.string().optional(),
	expectedVariants: z
		.array(
			z.object({
				path: z.string().min(1),
				contentHash: z.string().min(1),
			}),
		)
		.min(1),
});

const SkillRelativePathSchema = z
	.string()
	.min(1)
	.refine(
		(path) =>
			!path.startsWith("/") &&
			!path.includes("\0") &&
			!path.includes("\\") &&
			!path.split("/").some((segment) => segment === "." || segment === ".." || !segment),
		"Caminho relativo de arquivo inválido",
	);

export const SkillFileReadSchema = SkillVariantTargetSchema.extend({
	relativePath: SkillRelativePathSchema,
});

export const SkillTextExportSchema = SkillVariantTargetSchema;

export const SkillStandardizePreviewSchema = SkillVariantTargetSchema;

export const SkillStandardizeSchema = SkillVariantTargetSchema.extend({
	planHash: z.string().min(1),
});

export const SkillSyncSchema = z.object({
	planHash: z.string().min(1),
	choices: z.array(
		z.object({
			slug: z.string().min(1),
			sourcePath: z.string().min(1),
			hash: z.string().min(1),
		}),
	),
});

export const SkillDeleteSchema = SkillVariantTargetSchema;

export const SkillDeleteAllSchema = z.object({
	slug: SkillSlugSchema,
});

const SkillToolSchema = z.enum(["opencode", "claude-code", "codex", "agents", "koworker"]);

export const SkillPathAddSchema = z.object({
	tool: SkillToolSchema,
	path: z.string().min(1),
});

export const SkillPathRemoveSchema = z.object({
	id: z.string().min(1),
});

export const SkillSettingsSchema = z.object({
	slug: z.string().min(1),
	label: z.string().min(1).optional(),
	icon: z.string().min(1).optional(),
	color: z.string().min(1).optional(),
	categoryId: z.string().min(1).nullable().optional(),
	quickInvoke: z.boolean().optional(),
});

export type SkillCreateInput = z.infer<typeof SkillCreateSchema>;
export type SkillUpdateInput = z.infer<typeof SkillUpdateSchema>;
