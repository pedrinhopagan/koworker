import { z } from "zod";

export const BrowseDirectorySchema = z.object({
	path: z.string().optional(),
});

export const OsPathSchema = z.object({
	path: z.string().min(1),
});
