import { ORPCError } from "@orpc/server";

import { protectedProcedure } from "../auth/context";
import type { prompt_history } from "../db/connection";
import { dbPromptHistory } from "../db/prompt-history";
import {
	PromptHistoryCreateSchema,
	PromptHistoryListSchema,
	PromptHistoryRecordSchema,
	PromptHistoryUpdateSchema,
} from "../schemas/prompt-history";

const mapPromptHistory = (row: prompt_history) => ({
	id: row.id,
	kind: row.kind,
	text: row.text,
	prompt: row.prompt,
	target: row.target ?? undefined,
	agentSlug: row.agent_slug ?? undefined,
	skillSlug: row.skill_slug ?? undefined,
	projectId: row.project_id ?? undefined,
	projectName: row.project_name ?? undefined,
	routePath: row.route_path ?? undefined,
	model: row.model ?? undefined,
	effort: row.effort ?? undefined,
	createdAt: row.created_at,
});

export const promptHistoryRouter = {
	list: protectedProcedure.input(PromptHistoryListSchema).handler(async ({ input }) => {
		const result = await dbPromptHistory.list(input);

		return {
			items: result.items.map(mapPromptHistory),
			total: result.total,
			page: input.page,
			pageSize: input.pageSize,
			totalPages: Math.max(1, Math.ceil(result.total / input.pageSize)),
		};
	}),

	record: protectedProcedure.input(PromptHistoryRecordSchema).handler(async ({ input }) => {
		await dbPromptHistory.record(input);
		return { success: true };
	}),

	create: protectedProcedure.input(PromptHistoryCreateSchema).handler(async ({ input }) => {
		const row = await dbPromptHistory.create(input);
		if (!row) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Prompt não foi criado" });
		}

		return mapPromptHistory(row);
	}),

	update: protectedProcedure.input(PromptHistoryUpdateSchema).handler(async ({ input }) => {
		await dbPromptHistory.update(input);
		const row = await dbPromptHistory.getById(input.id);
		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "Prompt não encontrado" });
		}

		return mapPromptHistory(row);
	}),
};
