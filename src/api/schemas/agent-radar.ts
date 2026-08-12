import { z } from "zod";

export const AgentRadarPaneSchema = z.object({ paneId: z.string().min(1) });

// O texto vai literal para o prompt do agent no terminal, então o limite é o de uma mensagem que
// alguém digita no celular, não o de um arquivo colado.
export const AgentRadarSendSchema = z.object({
	paneId: z.string().min(1),
	text: z.string().trim().min(1).max(20_000),
});

export const AgentRadarInterruptSchema = AgentRadarPaneSchema;

export const AgentRadarSendKeysSchema = AgentRadarPaneSchema.extend({
	// Até 12 teclas: responder uma pergunta pelo app envia N descidas e um Enter de uma vez.
	keys: z
		.array(z.enum(["Up", "Down", "Left", "Right", "Enter", "Escape"]))
		.min(1)
		.max(12),
});
