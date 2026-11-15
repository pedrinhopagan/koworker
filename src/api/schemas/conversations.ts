import { z } from "zod";
import {
	ConversationEffortSchema,
	ConversationPermissionSchema,
	ConversationProfileSchema,
} from "@/lib/conversation";

const id = z.object({ id: z.string().uuid() });

export const ConversationSchemas = {
	id,
	pane: z.object({ paneId: z.string().min(1) }),
	profile: z.object({ profileId: ConversationProfileSchema }),
	cliHistory: z.object({
		projectId: z.string().uuid(),
		profileId: ConversationProfileSchema,
		cursor: z.string().optional(),
		search: z.string().trim().max(200).default(""),
	}),
	importCli: z.object({
		projectId: z.string().uuid(),
		profileId: ConversationProfileSchema,
		threadId: z.string().uuid(),
	}),
	create: z.object({
		projectId: z.string().uuid(),
		profileId: ConversationProfileSchema,
		permissionMode: ConversationPermissionSchema,
		model: z.string().min(1).optional(),
		effort: ConversationEffortSchema.optional(),
	}),
	update: id.extend({ title: z.string().trim().min(1).max(200) }),
	send: id.extend({
		clientMessageId: z.string().uuid(),
		text: z.string().trim().min(1).max(100_000),
		expectedTurnId: z.string().optional(),
		model: z.string().min(1).optional(),
		effort: ConversationEffortSchema.optional(),
	}),
	respond: id.extend({
		requestId: z.union([z.string(), z.number()]),
		runtimeId: z.string().uuid(),
		decision: z.enum(["accept", "acceptForSession", "decline", "cancel"]).optional(),
		answers: z.record(z.string(), z.array(z.string().min(1))).optional(),
	}),
};

export type ConversationCreateInput = z.infer<typeof ConversationSchemas.create>;
export type ConversationSendInput = z.infer<typeof ConversationSchemas.send>;
export type ConversationRespondInput = z.infer<typeof ConversationSchemas.respond>;
export type ConversationHistoryInput = z.infer<typeof ConversationSchemas.cliHistory>;
export type ConversationImportInput = z.infer<typeof ConversationSchemas.importCli>;
