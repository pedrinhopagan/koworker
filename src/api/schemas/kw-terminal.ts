import { z } from "zod";

export const KwTerminalTabCreateSchema = z.object({
	workspaceId: z.string(),
});

export const KwTerminalTabFocusSchema = z.object({
	tabId: z.string(),
});

export const KwTerminalTabCloseSchema = z.object({
	tabId: z.string(),
});

export const KwTerminalTabRenameSchema = z.object({
	tabId: z.string(),
	label: z.string().trim().min(1).max(60),
});

export const KwTerminalWorkspaceFocusSchema = z.object({
	workspaceId: z.string(),
});

export const KwTerminalWorkspaceRenameSchema = z.object({
	workspaceId: z.string(),
	label: z.string().trim().min(1),
});

export const KwTerminalWorkspaceCloseSchema = z.object({
	workspaceId: z.string(),
});

// O alvo da tab, não o rótulo: quem dispara diz se é sessão livre ou invocação de agent/skill, e o
// motor de nomes (`terminal/names.ts`) decide o slug. Sem `tab`, é sessão livre sem nome.
export const KwTerminalTabTargetSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("session"),
		label: z.string().trim().max(60).optional(),
	}),
	z.object({
		kind: z.literal("invocation"),
		invoked: z.enum(["agent", "skill"]),
		slug: z.string().trim().min(1).max(100),
	}),
]);

// Mesma grafia de `schemas/terminal.ts`: modelo e esforço viajam dentro de argv montado na shell
// do pane, então o charset tem que ser fechado aqui e não confiado ao chamador.
const KwTerminalModelSchema = z
	.string()
	.trim()
	.min(1)
	.max(100)
	.regex(/^[A-Za-z0-9._:@/-]+$/, "Modelo inválido");
const KwTerminalEffortSchema = z
	.string()
	.trim()
	.min(1)
	.max(20)
	.regex(/^[a-z]+$/, "Esforço inválido");
const KwTerminalAgentSchema = z
	.string()
	.trim()
	.min(1)
	.max(100)
	.regex(/^[A-Za-z0-9._-]+$/, "Agent inválido");

export const KwTerminalSessionStartSchema = z.object({
	projectId: z.string().min(1),
	cli: z.enum(["claude", "codex"]),
	tab: KwTerminalTabTargetSchema.optional(),
	prompt: z.string().trim().max(20_000).optional(),
	model: KwTerminalModelSchema.optional(),
	effort: KwTerminalEffortSchema.optional(),
	agent: KwTerminalAgentSchema.optional(),
	permissionMode: z.enum(["bypass", "plan", "acceptEdits", "default"]).optional(),
	approvalMode: z.enum(["bypass", "fullAuto", "readOnly", "default"]).optional(),
});

export const KwTerminalSessionResumeLastSchema = z.object({
	projectId: z.string().min(1),
	cli: z.enum(["claude", "codex"]),
});

// A rota chega de fora do app e vai direto para o router, então só um caminho
// interno absoluto passa: sem host, sem esquema e sem `//` inicial, que o
// navegador leria como outra origem.
export const KwTerminalNavigateSchema = z
	.object({
		route: z
			.string()
			.trim()
			.min(1)
			.max(512)
			.regex(/^\/(?!\/)[\w\-./?=&%#]*$/, "rota inválida"),
	})
	.strict();
