import { z } from "zod";

import { INVOKE_CLIS } from "@/constants/invoke";
import { SKILL_SLUG_PATTERN } from "@/constants/skill-slug";

const ProjectRefSchema = z.object({
	id: z.string(),
	name: z.string(),
});

const PermissionModeSchema = z.enum([
	"bypass",
	"plan",
	"acceptEdits",
	"default",
	"fullAuto",
	"readOnly",
]);
const AgentSlugSchema = z.string().regex(SKILL_SLUG_PATTERN, "Agent inválido");
const ModelSchema = z
	.string()
	.max(120)
	.regex(/^[A-Za-z0-9._:@/-]+$/, "Modelo inválido");
const EffortSchema = z
	.string()
	.max(20)
	.regex(/^[a-z]+$/, "Esforço inválido");

// Foco da sessão já aberta do CLI ativo. Sem `projectId` (nenhum projeto em foco na UI) qualquer
// sessão daquele CLI serve.
export const FocusAgentSchema = z.object({
	cli: z.enum(INVOKE_CLIS),
	projectId: z.string().optional(),
});

export const OpenForTaskSchema = z.object({
	projectId: z.string(),
	taskId: z.string(),
	taskTitle: z.string(),
	prompt: z.string().optional(),
	// CLI que roda o prompt; ausente = claude. No codex, `permissionMode` carrega o approvalMode.
	cli: z.enum(INVOKE_CLIS).optional(),
	agent: AgentSlugSchema.optional(),
	model: ModelSchema.optional(),
	effort: EffortSchema.optional(),
	permissionMode: PermissionModeSchema.optional(),
	forceNew: z.boolean().optional(),
	background: z.boolean().optional(),
});

export const OpenForRouteSchema = z.object({
	projectId: z.string(),
	routeId: z.string(),
	forceNew: z.boolean().optional(),
	background: z.boolean().optional(),
});

export const CloseProjectSessionSchema = z.object({
	projectId: z.string(),
});

export const CloseTaskWindowSchema = z.object({
	projectId: z.string(),
	taskId: z.string(),
});

export const InvocationSessionsSchema = z.object({
	projects: ProjectRefSchema.array(),
});
