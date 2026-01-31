import { z } from "zod";

import { AGENT_IDS } from "@/lib/ai/models-catalog";

export const ExecutionMessageRoleSchema = z.enum(["user", "assistant", "system", "tool"]);

export const ExecutionGetByTaskIdSchema = z.object({
	taskId: z.string().min(1),
});

export const ExecutionCreateMessageSchema = z.object({
	taskId: z.string().min(1),
	role: ExecutionMessageRoleSchema.optional(),
	content: z.string().trim().min(1),

	// MVP: agentId corresponds to the execution provider id.
	agentId: z.enum(AGENT_IDS).optional(),

	metadata: z.unknown().optional(),
	model: z.string().min(1).optional(),
	skill: z.string().min(1).optional(),
});

export type ExecutionCreateMessageInput = z.infer<typeof ExecutionCreateMessageSchema>;

// DB-level schemas (snake_case)
export const ExecutionThreadDbCreateSchema = z.object({
	id: z.string().min(1),
	task_id: z.string().min(1),
	created_at: z.number().int().optional(),
	updated_at: z.number().int().optional(),
});

export type ExecutionThreadDbCreateInput = z.infer<typeof ExecutionThreadDbCreateSchema>;

export const ExecutionMessageDbCreateSchema = z.object({
	id: z.string().min(1),
	thread_id: z.string().min(1).optional(),
	role: ExecutionMessageRoleSchema,
	content: z.string().min(1),
	metadata: z.string().optional(),
	model: z.string().optional(),
	skill: z.string().optional(),
	author_user_id: z.number().int().optional(),
	created_at: z.number().int().optional(),
});

export type ExecutionMessageDbCreateInput = z.infer<typeof ExecutionMessageDbCreateSchema>;
