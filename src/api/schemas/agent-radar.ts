import { z } from "zod";

import { KwTerminalEffortSchema, KwTerminalModelSchema } from "./kw-terminal";
import { TERMINAL_GRID_LIMITS, TERMINAL_INPUT_MAX_LENGTH } from "./terminal-workspace";

export const AgentRadarPaneSchema = z.object({ paneId: z.string().min(1) });

// O texto vai literal para o prompt do agent no terminal, então o limite é o de uma mensagem que
// alguém digita no celular, não o de um arquivo colado.
export const AgentRadarSendSchema = z.object({
	paneId: z.string().min(1),
	text: z.string().trim().min(1).max(20_000),
});

// A mensagem que muda de modelo, esforço ou CLI antes de ir: só o que difere da sessão viaja, e a
// CLI é sempre dita porque é ela que decide entre trocar no lugar, reabrir ou compactar e migrar.
export const AgentRadarSwitchModelSchema = AgentRadarSendSchema.extend({
	cli: z.enum(["claude", "codex"]),
	model: KwTerminalModelSchema.optional(),
	effort: KwTerminalEffortSchema.optional(),
});

export const AgentRadarInterruptSchema = AgentRadarPaneSchema;

export const AgentRadarSendKeysSchema = AgentRadarPaneSchema.extend({
	// Até 12 teclas: responder uma pergunta pelo app envia N descidas e um Enter de uma vez.
	keys: z
		.array(z.enum(["Up", "Down", "Left", "Right", "Enter", "Escape"]))
		.min(1)
		.max(12),
});

export const AgentRadarTerminalInputSchema = AgentRadarPaneSchema.extend({
	data: z.string().min(1).max(TERMINAL_INPUT_MAX_LENGTH),
});

export const AgentRadarTerminalResizeSchema = AgentRadarPaneSchema.extend({
	cols: z.number().int().min(TERMINAL_GRID_LIMITS.minCols).max(TERMINAL_GRID_LIMITS.maxCols),
	rows: z.number().int().min(TERMINAL_GRID_LIMITS.minRows).max(TERMINAL_GRID_LIMITS.maxRows),
});

// Delta em linhas do histórico do pane: positivo sobe no passado, negativo desce pro vivo. O teto
// e o clamp no topo vivem na ponte do espelho.
export const AgentRadarTerminalScrollSchema = AgentRadarPaneSchema.extend({
	delta: z.number().int().min(-5000).max(5000),
});

// "history": o wheel virou offset na janela da ponte. "forward": o pane não tem histórico de
// terminal (TUI em alt screen) e o cliente encaminha o gesto como setas pro agent.
export const AgentRadarTerminalScrollResultSchema = z.object({
	ok: z.boolean(),
	mode: z.enum(["history", "forward"]).optional(),
});

// O catálogo que o seletor de modelo mostra: por CLI, os modelos que ela aceita e os níveis de
// esforço de cada um. `defaultEffort` é o que o CLI usa quando nada é dito.
export type CliModelOption = {
	id: string;
	label: string;
	hint: string;
	efforts: string[];
	defaultEffort: string | null;
};

export type ModelCatalog = Record<"claude" | "codex", CliModelOption[]>;
