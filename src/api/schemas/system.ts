import { z } from "zod";

export const BrowseDirectorySchema = z.object({
	path: z.string().optional(),
});

export const OsPathSchema = z.object({
	path: z.string().min(1),
});

export const LinkTargetSchema = z.object({
	target: z.string().trim().min(1).max(8_192),
	cwd: z.string().min(1).optional(),
});
