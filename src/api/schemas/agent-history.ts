import { z } from "zod";

export const HistoryCliSchema = z.enum(["claude", "codex"]);
export type HistoryCli = z.infer<typeof HistoryCliSchema>;

export const AgentHistoryListSchema = z.object({
	projectId: z.string().min(1).nullable().default(null),
	cli: HistoryCliSchema.nullable().default(null),
	search: z.string().max(200).default(""),
	// A página é o que decide quantos transcripts são lidos por inteiro: o vínculo com a tarefa sai
	// da conversa toda, não do cabeçalho.
	limit: z.number().int().min(1).max(60).default(24),
	offset: z.number().int().min(0).default(0),
});

export const AgentHistorySessionSchema = z.object({
	cli: HistoryCliSchema,
	sessionId: z.string().min(1),
});
