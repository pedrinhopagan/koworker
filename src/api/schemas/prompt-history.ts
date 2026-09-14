import { z } from "zod";

import { normalizePrompt } from "../helpers/agent-history/prompt-text";

const optionalText = z
	.string()
	.trim()
	.transform((value) => (value.length > 0 ? value : undefined))
	.optional();

export const PromptSourceSchema = z.enum(["claude", "codex", "copy"]);
export type PromptSource = z.infer<typeof PromptSourceSchema>;

export const PromptHistoryListSchema = z.object({
	page: z.number().int().min(1).optional().default(1),
	pageSize: z.number().int().min(1).max(50).optional().default(20),
	q: optionalText,
	source: PromptSourceSchema.optional(),
	projectId: optionalText,
});

export const PromptCopySchema = z
	.object({
		prompt: z.string().trim().min(1),
		projectId: optionalText,
		projectName: optionalText,
	})
	.transform((input) => ({ ...input, norm: normalizePrompt(input.prompt) }));

export type PromptHistoryListInput = z.infer<typeof PromptHistoryListSchema>;
export type PromptCopyInput = z.infer<typeof PromptCopySchema>;
