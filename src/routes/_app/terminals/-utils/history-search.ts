import { z } from "zod";

import { HistoryCliSchema } from "@/api/schemas/agent-history";

// Os filtros do histórico vivem na URL: a lista e a conversa aberta são a mesma tela em dois passos,
// e trocar de sessão não pode perder o recorte que levou até ela.
export const ALL_PROJECTS = "todos";

export const historySearchSchema = z.object({
	// Ausente é o projeto em destaque do app; `todos` é a escolha explícita de não filtrar.
	projectId: z.string().min(1).optional(),
	cli: HistoryCliSchema.optional(),
	q: z.string().optional(),
});

export type HistorySearchParams = z.infer<typeof historySearchSchema>;
