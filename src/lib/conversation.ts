import { z } from "zod";

export const ConversationProfileSchema = z.enum(["default", "personal"]);
export const ConversationEffortSchema = z.enum([
	"none",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
	"ultra",
]);
export const ConversationPermissionSchema = z.enum(["workspace", "full"]);

const CodexContentSchema = z
	.object({
		type: z.string(),
		text: z.string().optional(),
		path: z.string().optional(),
		url: z.string().optional(),
		name: z.string().optional(),
		imageUrl: z.string().optional(),
	})
	.passthrough();

const CodexResultContentSchema = z.unknown().transform((value) => {
	const parsed = CodexContentSchema.safeParse(value);
	if (parsed.success) {
		return parsed.data;
	}
	return { type: "unknown", text: JSON.stringify(value, null, 2) };
});

export const CodexItemSchema = z
	.object({
		id: z.string(),
		type: z.string(),
		clientId: z.string().nullish(),
		text: z.string().optional(),
		phase: z.string().nullish(),
		content: z.union([z.array(CodexContentSchema), z.array(z.string())]).optional(),
		summary: z.array(z.string()).optional(),
		command: z.string().optional(),
		commandActions: z
			.array(
				z.object({
					type: z.string(),
					command: z.string(),
					name: z.string().optional(),
					path: z.string().nullish(),
					query: z.string().nullish(),
				}),
			)
			.optional(),
		cwd: z.string().optional(),
		status: z.string().optional(),
		aggregatedOutput: z.string().nullish(),
		exitCode: z.number().nullish(),
		durationMs: z.number().nullish(),
		changes: z
			.array(
				z.object({
					path: z.string(),
					diff: z.string(),
					kind: z.object({ type: z.string(), move_path: z.string().nullish() }).optional(),
				}),
			)
			.optional(),
		tool: z.string().optional(),
		name: z.string().optional(),
		server: z.string().optional(),
		namespace: z.string().nullish(),
		arguments: z.unknown().optional(),
		output: z.unknown().optional(),
		contentItems: z.array(CodexContentSchema).nullish(),
		result: z
			.union([
				z.string(),
				z
					.object({
						content: z.array(CodexResultContentSchema),
						structuredContent: z.unknown().nullish(),
					})
					.passthrough(),
			])
			.nullish(),
		error: z.object({ message: z.string() }).nullish(),
		success: z.boolean().nullish(),
		results: z.array(z.unknown()).nullish(),
		query: z.string().optional(),
		action: z
			.object({
				type: z.string(),
				query: z.string().nullish(),
				queries: z.array(z.string()).nullish(),
				url: z.string().nullish(),
				pattern: z.string().nullish(),
			})
			.nullish(),
		path: z.string().optional(),
		review: z.string().optional(),
		prompt: z.string().nullish(),
		receiverThreadIds: z.array(z.string()).optional(),
		questions: z
			.array(z.object({ title: z.string(), options: z.array(z.string()).nullish() }))
			.nullish(),
	})
	.passthrough();

export const CodexTurnSchema = z.object({
	id: z.string(),
	status: z.enum(["inProgress", "completed", "interrupted", "failed"]),
	items: z.array(CodexItemSchema),
	itemsView: z.enum(["notLoaded", "summary", "full"]).optional(),
	startedAt: z.number().nullish(),
	completedAt: z.number().nullish(),
	durationMs: z.number().nullish(),
	error: z.object({ message: z.string() }).nullish(),
});

export const CodexThreadSchema = z.object({
	id: z.string(),
	turns: z.array(CodexTurnSchema),
	cwd: z.string().optional(),
	model: z.string().nullish(),
	reasoningEffort: ConversationEffortSchema.nullish(),
});
export const CodexThreadResponseSchema = z.object({
	thread: CodexThreadSchema,
	model: z.string(),
	reasoningEffort: ConversationEffortSchema.nullish(),
});

export const CodexHistoryThreadSchema = z.object({
	id: z.string().uuid(),
	cwd: z.string().min(1),
	name: z.string().nullish(),
	preview: z.string(),
	model: z.string().nullish(),
	reasoningEffort: ConversationEffortSchema.nullish(),
	createdAt: z.number().transform((seconds) => seconds * 1000),
	updatedAt: z.number().transform((seconds) => seconds * 1000),
});

export const CodexHistoryListSchema = z.object({
	data: z.array(CodexHistoryThreadSchema),
	nextCursor: z.string().nullable(),
});

export const CodexHistoryReadSchema = z.object({
	thread: CodexHistoryThreadSchema.extend({ turns: z.array(CodexTurnSchema) }),
});

export const CodexModelListSchema = z.object({
	data: z.array(
		z.object({
			id: z.string(),
			model: z.string(),
			displayName: z.string(),
			hidden: z.boolean(),
			isDefault: z.boolean(),
			defaultReasoningEffort: ConversationEffortSchema,
			supportedReasoningEfforts: z.array(
				z.object({ reasoningEffort: ConversationEffortSchema, description: z.string() }),
			),
		}),
	),
});

export const ConversationQuestionSchema = z.object({
	id: z.string(),
	header: z.string(),
	question: z.string(),
	isSecret: z.boolean().optional(),
	options: z.array(z.object({ label: z.string(), description: z.string() })).nullish(),
});

export const ConversationRequestSchema = z.object({
	id: z.union([z.string(), z.number()]),
	runtimeId: z.string(),
	method: z.string(),
	turnId: z.string(),
	itemId: z.string(),
	reason: z.string().nullish(),
	command: z.string().nullish(),
	questions: z.array(ConversationQuestionSchema).optional(),
	decisions: z.array(z.enum(["accept", "acceptForSession", "decline", "cancel"])).optional(),
	details: z.string().optional(),
});

export const ConversationProjectionSchema = z.object({
	turns: z.array(CodexTurnSchema),
	activeTurnId: z.string().nullable(),
	requests: z.array(ConversationRequestSchema),
	diff: z.string(),
	error: z.string().nullable(),
});

export const ConversationMessageStatusSchema = z.enum([
	"sending",
	"accepted",
	"confirmed",
	"uncertain",
	"failed",
]);
export type ConversationProjection = z.infer<typeof ConversationProjectionSchema>;
export type ConversationRequest = z.infer<typeof ConversationRequestSchema>;
export type CodexItem = z.infer<typeof CodexItemSchema>;
export type CodexTurn = z.infer<typeof CodexTurnSchema>;

export function emptyConversationProjection(): ConversationProjection {
	return { turns: [], activeTurnId: null, requests: [], diff: "", error: null };
}
