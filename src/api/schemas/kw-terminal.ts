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
	label: z.string().trim().min(1),
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

export const KwTerminalSessionStartSchema = z.object({
	projectId: z.string().min(1),
	cli: z.enum(["claude", "codex"]),
	label: z.string().trim().max(60).optional(),
	prompt: z.string().trim().max(20_000).optional(),
	model: z.string().trim().min(1).max(100).optional(),
	effort: z.string().trim().min(1).max(40).optional(),
	agent: z.string().trim().min(1).max(100).optional(),
	permissionMode: z.enum(["plan", "acceptEdits", "default"]).optional(),
	approvalMode: z.enum(["fullAuto", "readOnly", "default"]).optional(),
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
