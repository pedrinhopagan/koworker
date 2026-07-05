import { z } from "zod";

const optionalText = z
	.string()
	.trim()
	.transform((value) => (value.length > 0 ? value : undefined))
	.optional();

const nullableText = z
	.string()
	.trim()
	.transform((value) => (value.length > 0 ? value : null))
	.nullable()
	.optional();

export const PromptHistoryKindSchema = z.enum(["copy", "agent", "skill"]);

export const PromptHistoryRecordSchema = z.object({
	kind: PromptHistoryKindSchema,
	text: z.string(),
	prompt: z.string().min(1),
	target: optionalText,
	agentSlug: optionalText,
	skillSlug: optionalText,
	projectId: optionalText,
	projectName: optionalText,
	routePath: optionalText,
	model: optionalText,
	effort: optionalText,
});

export const PromptHistoryListSchema = z.object({
	page: z.number().int().min(1).optional().default(1),
	pageSize: z.number().int().min(1).max(50).optional().default(20),
	q: optionalText,
	kind: PromptHistoryKindSchema.optional(),
	projectId: optionalText,
});

export const PromptHistoryCreateSchema = PromptHistoryRecordSchema.extend({
	text: z.string().trim(),
	prompt: z.string().trim().min(1),
});

export const PromptHistoryUpdateSchema = z.object({
	id: z.string().trim().min(1),
	kind: PromptHistoryKindSchema.optional(),
	text: z.string().trim().optional(),
	prompt: z.string().trim().min(1).optional(),
	target: nullableText,
	agentSlug: nullableText,
	skillSlug: nullableText,
	projectId: nullableText,
	projectName: nullableText,
	routePath: nullableText,
	model: nullableText,
	effort: nullableText,
});

export type PromptHistoryRecordInput = z.infer<typeof PromptHistoryRecordSchema>;
export type PromptHistoryListInput = z.infer<typeof PromptHistoryListSchema>;
export type PromptHistoryCreateInput = z.infer<typeof PromptHistoryCreateSchema>;
export type PromptHistoryUpdateInput = z.infer<typeof PromptHistoryUpdateSchema>;
