import { z } from "zod";

export const AgentListSchema = z.object({
	projectName: z.string().optional(),
});

export const AgentCreateSchema = z.object({
	slug: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
	description: z.string().min(1),
	content: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export const AgentUpdateSchema = z.object({
	path: z.string().min(1),
	description: z.string().min(1),
	content: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export const AgentGetSchema = z.object({
	slug: z.string().min(1),
	projectName: z.string().optional(),
});

export const AgentStandardizeSchema = z.object({
	slug: z.string().min(1),
	projectName: z.string().optional(),
	sourcePath: z.string().min(1),
});

export const AgentDeleteSchema = z.object({
	path: z.string().min(1),
});

export const AgentDeleteAllSchema = z.object({
	slug: z.string().min(1),
	projectName: z.string().optional(),
});

const AgentToolSchema = z.enum(["claude-code", "opencode", "codex", "koworker"]);

export const AgentPathAddSchema = z.object({
	tool: AgentToolSchema,
	path: z.string().min(1),
});

export const AgentPathRemoveSchema = z.object({
	id: z.string().min(1),
});

export const AgentSettingsSchema = z.object({
	slug: z.string().min(1),
	label: z.string().min(1).optional(),
	icon: z.string().min(1).optional(),
	color: z.string().min(1).optional(),
});

export type AgentCreateInput = z.infer<typeof AgentCreateSchema>;
export type AgentUpdateInput = z.infer<typeof AgentUpdateSchema>;
