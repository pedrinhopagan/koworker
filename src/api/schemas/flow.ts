import { z } from "zod";

// Boundary do fluxo autônomo: identifica a tarefa a rodar/acompanhar. O runner resolve a row e o
// projeto a partir daqui.
export const FlowTaskSchema = z.object({
	taskId: z.string().trim().min(1),
	interactionMode: z.enum(["unattended", "interactive"]).default("unattended"),
});

export type FlowTaskInput = z.infer<typeof FlowTaskSchema>;
