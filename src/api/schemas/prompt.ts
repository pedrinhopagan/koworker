import { z } from "zod";

export const PromptExecuteSchema = z
	.object({
		clientRequestId: z.string().uuid(),
		projectId: z.string().trim().min(1),
		taskId: z.string().trim().min(1).optional(),
		createTaskTitle: z.string().trim().optional(),
		prompt: z.string().trim().min(1),
		originalPrompt: z.string().trim().min(1).optional(),
		source: z.enum(["merge_action", "automation"]),
		interactionMode: z.literal("unattended"),
		inputKind: z.enum(["text", "audio_transcript", "task_flow"]),
		cli: z.enum(["claude", "codex"]),
		permissionMode: z.string().trim().min(1).optional(),
		agent: z.string().trim().min(1).optional(),
		model: z.string().trim().min(1).optional(),
		effort: z.string().trim().min(1).optional(),
		approvalMode: z.string().trim().min(1).optional(),
	})
	.refine((input) => !(input.taskId && input.createTaskTitle !== undefined), {
		message: "Escolha uma tarefa existente ou crie uma nova",
	});

export type PromptExecuteInput = z.infer<typeof PromptExecuteSchema>;

export const PromptRunIdSchema = z.object({
	runId: z.string().trim().min(1),
});

export type PromptRunIdInput = z.infer<typeof PromptRunIdSchema>;

export const PromptRunListSchema = z.object({
	limit: z.number().int().min(1).max(50).default(20),
});

export const PromptRunClearSchema = z.object({
	runIds: z.array(z.string().trim().min(1)).min(1).max(50),
});

export const PromptRunRetrySchema = z.object({
	runId: z.string().trim().min(1),
	clientRequestId: z.string().uuid(),
});

export const AudioTranscriptionSchema = z.object({
	file: z
		.file()
		.max(24 * 1024 * 1024)
		.mime([
			"audio/webm",
			"audio/mp4",
			"audio/mpeg",
			"audio/mp3",
			"audio/ogg",
			"audio/wav",
			"audio/x-wav",
			"audio/aac",
		]),
});
