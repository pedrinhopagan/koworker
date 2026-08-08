import { z } from "zod";

export const AgentRadarPaneSchema = z.object({ paneId: z.string().min(1) });

// O texto vai literal para o prompt do agent no terminal, então o limite é o de uma mensagem que
// alguém digita no celular, não o de um arquivo colado.
export const AgentRadarSendSchema = z.object({
	paneId: z.string().min(1),
	text: z.string().trim().min(1).max(20_000),
});

export const AgentRadarInterruptSchema = AgentRadarPaneSchema;
