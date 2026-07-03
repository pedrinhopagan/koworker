import { z } from "zod";

const ProjectRefSchema = z.object({
	id: z.string(),
	name: z.string(),
});

export const OpenForTaskSchema = z.object({
	projectId: z.string(),
	projectName: z.string(),
	mainRoute: z.string(),
	taskId: z.string(),
	taskTitle: z.string(),
	prompt: z.string().optional(),
	// CLI que roda o prompt; ausente = claude. No codex, `permissionMode` carrega o approvalMode.
	cli: z.enum(["claude", "codex"]).optional(),
	agent: z.string().optional(),
	model: z.string().optional(),
	effort: z.string().optional(),
	permissionMode: z.string().optional(),
	forceNew: z.boolean().optional(),
	background: z.boolean().optional(),
});

export const OpenForRouteSchema = z.object({
	projectId: z.string(),
	projectName: z.string(),
	routeId: z.string(),
	routeName: z.string(),
	routePath: z.string(),
	command: z.string().optional(),
	forceNew: z.boolean().optional(),
	background: z.boolean().optional(),
});

export const CloseProjectSessionSchema = z.object({
	projectId: z.string(),
	projectName: z.string(),
});

export const CloseTaskWindowSchema = z.object({
	projectId: z.string(),
	projectName: z.string(),
	taskId: z.string(),
	taskTitle: z.string(),
});

export const InvocationSessionsSchema = z.object({
	projects: ProjectRefSchema.array(),
});
