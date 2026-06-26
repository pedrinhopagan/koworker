import { z } from "zod";

export const PromptHistoryRecordSchema = z.object({
	kind: z.enum(["copy", "agent", "skill"]),
	text: z.string(),
	prompt: z.string().min(1),
	target: z.string().min(1).optional(),
	agentSlug: z.string().min(1).optional(),
	skillSlug: z.string().min(1).optional(),
	projectId: z.string().min(1).optional(),
	projectName: z.string().min(1).optional(),
	routePath: z.string().min(1).optional(),
	model: z.string().min(1).optional(),
	effort: z.string().min(1).optional(),
});

export type PromptHistoryRecordInput = z.infer<typeof PromptHistoryRecordSchema>;
