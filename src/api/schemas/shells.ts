import { z } from "zod";

import {
	TERMINAL_GRID_LIMITS,
	TERMINAL_INPUT_MAX_LENGTH,
	TERMINAL_LABEL_MAX_LENGTH,
} from "./terminal-workspace";

export const ShellCreateSchema = z.object({
	cwd: z.string().trim().min(1).max(1024),
	label: z.string().trim().max(TERMINAL_LABEL_MAX_LENGTH).optional(),
	projectId: z.string().uuid().nullable().optional(),
	cols: z
		.number()
		.int()
		.min(TERMINAL_GRID_LIMITS.minCols)
		.max(TERMINAL_GRID_LIMITS.maxCols)
		.default(80),
	rows: z
		.number()
		.int()
		.min(TERMINAL_GRID_LIMITS.minRows)
		.max(TERMINAL_GRID_LIMITS.maxRows)
		.default(24),
});

export const ShellIdSchema = z.object({
	id: z.string().min(1),
});

export const ShellRenameSchema = z.object({
	id: z.string().min(1),
	label: z.string().trim().min(1).max(TERMINAL_LABEL_MAX_LENGTH),
});

export const ShellResizeSchema = z.object({
	id: z.string().min(1),
	cols: z.number().int().min(TERMINAL_GRID_LIMITS.minCols).max(TERMINAL_GRID_LIMITS.maxCols),
	rows: z.number().int().min(TERMINAL_GRID_LIMITS.minRows).max(TERMINAL_GRID_LIMITS.maxRows),
});

export const ShellInputSchema = z.object({
	id: z.string().min(1),
	data: z.string().max(TERMINAL_INPUT_MAX_LENGTH),
});
