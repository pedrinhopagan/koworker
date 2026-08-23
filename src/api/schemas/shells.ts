import { z } from "zod";

export const ShellCreateSchema = z.object({
	cwd: z.string().trim().min(1).max(1024),
	label: z.string().trim().max(60).optional(),
	projectId: z.string().uuid().nullable().optional(),
	cols: z.number().int().min(2).max(500).default(80),
	rows: z.number().int().min(2).max(200).default(24),
});

export const ShellIdSchema = z.object({
	id: z.string().min(1),
});

export const ShellRenameSchema = z.object({
	id: z.string().min(1),
	label: z.string().trim().min(1).max(60),
});

export const ShellResizeSchema = z.object({
	id: z.string().min(1),
	cols: z.number().int().min(2).max(500),
	rows: z.number().int().min(2).max(200),
});

// Teclado e colagem do cliente. Texto livre: o PTY do outro lado interpreta.
export const ShellInputSchema = z.object({
	id: z.string().min(1),
	data: z.string().max(8192),
});
