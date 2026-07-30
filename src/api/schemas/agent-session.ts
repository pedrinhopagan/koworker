import { z } from "zod";

import { CODEX_APPROVAL_MODES, INVOKE_CLIS } from "@/constants/invoke";

const PERMISSION_MODES = ["acceptEdits", "default", "plan", "bypassPermissions"] as const;

// Cada CLI tem a sua política: o `claude` recebe `--permission-mode`, o `codex` recebe a combinação
// de sandbox e aprovação. As duas chegam sempre e o CLI escolhido decide qual vira a da sessão.
export const AgentSessionStartSchema = z
	.object({
		projectId: z.string().trim().min(1),
		taskId: z.string().trim().min(1).optional(),
		createTaskTitle: z.string().trim().optional(),
		prompt: z.string().trim().min(1),
		originalPrompt: z.string().trim().min(1).optional(),
		inputKind: z.enum(["text", "audio_transcript"]).default("text"),
		cli: z.enum(INVOKE_CLIS).default("claude"),
		model: z.string().trim().min(1).optional(),
		effort: z.string().trim().min(1).optional(),
		agent: z.string().trim().min(1).optional(),
		permissionMode: z.enum(PERMISSION_MODES).default("acceptEdits"),
		approvalMode: z.enum(CODEX_APPROVAL_MODES).default("fullAuto"),
	})
	.refine((input) => !(input.taskId && input.createTaskTitle !== undefined), {
		message: "Escolha uma tarefa existente ou crie uma nova",
	});

export const AgentSessionIdSchema = z.object({
	sessionId: z.string().trim().min(1),
});

export const AgentSessionTurnSchema = z.object({
	sessionId: z.string().trim().min(1),
	prompt: z.string().trim().min(1),
	originalPrompt: z.string().trim().min(1).optional(),
	inputKind: z.enum(["text", "audio_transcript"]).default("text"),
});

export const AgentSessionPermissionSchema = z.object({
	sessionId: z.string().trim().min(1),
	requestId: z.string().trim().min(1),
	decision: z.enum(["allow", "deny"]),
	reason: z.string().trim().min(1).optional(),
});

export const AgentSessionAnswerSchema = z
	.object({
		sessionId: z.string().trim().min(1),
		questionId: z.string().trim().min(1),
		answers: z.array(z.string().trim().min(1)).default([]),
		freeText: z.string().trim().min(1).optional(),
	})
	.refine((input) => input.answers.length > 0 || !!input.freeText, {
		message: "Escolha uma opção ou escreva a resposta",
	});

export const AgentSessionModeSchema = z.object({
	sessionId: z.string().trim().min(1),
	permissionMode: z.enum([...PERMISSION_MODES, ...CODEX_APPROVAL_MODES]),
});

export const AgentSessionListSchema = z.object({
	limit: z.number().int().min(1).max(50).default(20),
});

export const AgentSessionClearSchema = z.object({
	sessionIds: z.array(z.string().trim().min(1)).min(1).max(50),
});
