import { z } from "zod";

export const AgentSessionIdSchema = z.object({
	sessionId: z.string().trim().min(1),
});

export const AgentSessionListSchema = z.object({
	limit: z.number().int().min(1).max(50).default(20),
});
