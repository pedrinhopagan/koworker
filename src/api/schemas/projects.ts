import { z } from "zod";

export const ProjectIdSchema = z.object({
	id: z.string().min(1),
});

// Caminho relativo de um doc principal: segmentos `/`, sem barra inicial, sem travessia, terminando
// num `.md`. É boundary — vira parte de um path no FS; o nome reconhecido é checado no helper.
const projectDocPath = z
	.string()
	.trim()
	.min(1)
	.regex(/^[^/\\][^\\]*\.md$/, "Path must be a relative .md without backslashes")
	.refine(
		(path) =>
			!path.split("/").some((segment) => segment === "" || segment === "." || segment === ".."),
		"Path must not contain empty or traversal segments",
	);

export const ProjectDocWriteSchema = z.object({
	id: z.string().min(1),
	path: projectDocPath,
	content: z.string(),
});

export const ProjectCreateSchema = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
	mainRoute: z.string().min(1),
});

export const ProjectUpdateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).optional(),
	description: z.string().optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
	mainRoute: z.string().min(1).optional(),
	hideTerminal: z.boolean().optional(),
});

export const ProjectReorderSchema = z.object({
	orderedIds: z.array(z.string().min(1)).min(1),
});

export type ProjectCreateInput = z.infer<typeof ProjectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof ProjectUpdateSchema>;

export const ProjectDbCreateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	color: z.string().optional(),
	display_order: z.number().int().optional(),
	main_route: z.string().min(1),
	hide_terminal: z.number().int().optional(),
	created_at: z.number().int().optional(),
	updated_at: z.number().int().optional(),
	deleted_at: z.number().int().optional(),
});

export const ProjectDbUpdateSchema = ProjectDbCreateSchema.omit({
	id: true,
	created_at: true,
}).partial();

export type ProjectDbCreateInput = z.infer<typeof ProjectDbCreateSchema>;
export type ProjectDbUpdateInput = z.infer<typeof ProjectDbUpdateSchema>;
