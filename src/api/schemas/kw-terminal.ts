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
