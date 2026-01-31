import { ORPCError } from "@orpc/server";

import { protectedProcedure } from "../auth/context";
import type { execution_messages, execution_threads } from "../db/connection";
import { dbExecution } from "../db/execution";
import { jsonParse, jsonStringify } from "../helpers/json";
import { ExecutionCreateMessageSchema, ExecutionGetByTaskIdSchema } from "../schemas";
import { MODELS_BY_AGENT, isModelAllowed } from "@/lib/ai/models-catalog";

const mapThread = (row: execution_threads) => ({
	id: row.id,
	taskId: row.task_id,
	createdAt: row.created_at,
	updatedAt: row.updated_at ?? undefined,
});

const mapMessage = (row: execution_messages) => ({
	id: row.id,
	threadId: row.thread_id,
	role: row.role,
	content: row.content,
	metadata: jsonParse<unknown>(row.metadata),
	model: row.model ?? undefined,
	skill: row.skill ?? undefined,
	authorUserId: row.author_user_id ?? undefined,
	createdAt: row.created_at,
});

export const executionRouter = {
	getByTaskId: protectedProcedure.input(ExecutionGetByTaskIdSchema).handler(async ({ input }) => {
		const { thread, messages } = await dbExecution.getByTaskId(input.taskId);
		return {
			thread: thread ? mapThread(thread) : null,
			messages: messages.map(mapMessage),
		};
	}),

	createMessage: protectedProcedure
		.input(ExecutionCreateMessageSchema)
		.handler(async ({ input, context }) => {
			const role = input.role ?? "user";

			if (input.model && input.agentId && !isModelAllowed(input.agentId, input.model)) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Model '${input.model}' is not allowed for agent '${input.agentId}'.`,
					data: {
						agentId: input.agentId,
						model: input.model,
						allowedModels: MODELS_BY_AGENT[input.agentId],
					},
				});
			}

			const threadId = crypto.randomUUID();
			const messageId = crypto.randomUUID();

			const authorUserId = role === "user" ? context.user.id : undefined;

			const metadata =
				input.agentId === undefined
					? input.metadata
					: typeof input.metadata === "object" && input.metadata !== null && !Array.isArray(input.metadata)
						? { ...(input.metadata as Record<string, unknown>), agentId: input.agentId }
						: { agentId: input.agentId, metadata: input.metadata };

			const thread = await dbExecution.createMessage({
				taskId: input.taskId,
				threadCreate: {
					id: threadId,
					task_id: input.taskId,
				},
				messageCreate: {
					id: messageId,
					role,
					content: input.content,
					metadata: jsonStringify(metadata),
					model: input.model,
					skill: input.skill,
					author_user_id: authorUserId,
				},
			});

			const result = await dbExecution.getByTaskId(input.taskId);
			return {
				thread: result.thread ? mapThread(result.thread) : thread ? mapThread(thread) : null,
				messages: result.messages.map(mapMessage),
			};
		}),
};
