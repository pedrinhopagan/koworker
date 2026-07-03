import { z } from "zod";

import { PROMPT_TEMPLATE_SLUGS } from "@/constants/prompt-templates";

// Motores headless que preenchem a estrutura: Opus e Sonnet rodam via `claude`; GPT-5.5 via `codex`.
// O conjunto é fechado — o helper de spawn ramifica por ele. Cada motor aceita um effort próprio.
export const PROMPT_ENGINES = ["opus", "sonnet", "gpt-5.5"] as const;

export type PromptEngine = (typeof PROMPT_ENGINES)[number];

export const PROMPT_ENGINE_EFFORTS = ["low", "medium", "high", "xhigh"] as const;

export type PromptEngineEffort = (typeof PROMPT_ENGINE_EFFORTS)[number];

// Boundary de entrada do autofill: a instrução livre + o motor/esforço + a tarefa aberta (opcional,
// dá contexto ao agente). Texto vazio é erro — o botão só dispara com algo escrito.
export const PromptAutofillSchema = z.object({
	text: z.string().trim().min(1),
	engine: z.enum(PROMPT_ENGINES).default("opus"),
	effort: z.enum(PROMPT_ENGINE_EFFORTS).default("medium"),
	taskId: z.string().trim().min(1).optional(),
});

export type PromptAutofillInput = z.infer<typeof PromptAutofillSchema>;

// Boundary de saída: o motor devolve texto (envelope/arquivo) que só vira o shape interno depois de
// cruzar este schema. `structure` é um slug conhecido; `fields` são os campos do template escolhido
// (chaves livres, o corpo do prompt só lê as que o template define); `invocations` são sugestões de
// agent/skill que viram a seleção do painel de invocação.
export const PromptAutofillResultSchema = z.object({
	structure: z.enum(PROMPT_TEMPLATE_SLUGS),
	fields: z.record(z.string(), z.string()),
	invocations: z.array(
		z.object({
			kind: z.enum(["agent", "skill"]),
			slug: z.string().min(1),
		}),
	),
});

export type PromptAutofillResult = z.infer<typeof PromptAutofillResultSchema>;

export const PromptExecuteSchema = z.object({
	projectId: z.string().trim().min(1),
	prompt: z.string().trim().min(1),
	cli: z.enum(["claude", "codex"]),
	permissionMode: z.string().trim().min(1).optional(),
	agent: z.string().trim().min(1).optional(),
	model: z.string().trim().min(1).optional(),
	effort: z.string().trim().min(1).optional(),
	approvalMode: z.string().trim().min(1).optional(),
});

export type PromptExecuteInput = z.infer<typeof PromptExecuteSchema>;

export const PromptRunIdSchema = z.object({
	runId: z.string().trim().min(1),
});

export type PromptRunIdInput = z.infer<typeof PromptRunIdSchema>;
