import { sql, type SelectQueryBuilder } from "kysely";

import type {
	PromptHistoryCreateInput,
	PromptHistoryListInput,
	PromptHistoryRecordInput,
	PromptHistoryUpdateInput,
} from "../schemas/prompt-history";
import { db, type DB, type prompt_history } from "./connection";
import { cleanUpdate } from "./helpers";

function applyPromptHistoryFilters<O extends Record<string, unknown>>(
	query: SelectQueryBuilder<DB, "prompt_history", O>,
	input: PromptHistoryListInput,
) {
	let next = query;

	if (input.kind) {
		next = next.where("kind", "=", input.kind);
	}

	if (input.projectId) {
		next = next.where("project_id", "=", input.projectId);
	}

	if (input.q) {
		const term = `%${input.q.toLowerCase()}%`;
		next = next.where(sql<boolean>`
			(
			lower(text) like ${term}
			or lower(prompt) like ${term}
			or lower(coalesce(target, '')) like ${term}
			or lower(coalesce(agent_slug, '')) like ${term}
			or lower(coalesce(skill_slug, '')) like ${term}
			or lower(coalesce(project_name, '')) like ${term}
			or lower(coalesce(route_path, '')) like ${term}
			)
		`);
	}

	return next;
}

function promptHistoryValues(input: PromptHistoryRecordInput) {
	return {
		kind: input.kind,
		text: input.text,
		prompt: input.prompt,
		...(input.target !== undefined && { target: input.target }),
		...(input.agentSlug !== undefined && { agent_slug: input.agentSlug }),
		...(input.skillSlug !== undefined && { skill_slug: input.skillSlug }),
		...(input.projectId !== undefined && { project_id: input.projectId }),
		...(input.projectName !== undefined && { project_name: input.projectName }),
		...(input.routePath !== undefined && { route_path: input.routePath }),
		...(input.model !== undefined && { model: input.model }),
		...(input.effort !== undefined && { effort: input.effort }),
	};
}

export const dbPromptHistory = {
	getById: (id: string) =>
		db.selectFrom("prompt_history").selectAll().where("id", "=", id).executeTakeFirst(),

	list: async (input: PromptHistoryListInput) => {
		const filtered = applyPromptHistoryFilters(db.selectFrom("prompt_history"), input);
		const totalRow = await filtered.select(sql<number>`count(*)`.as("total")).executeTakeFirst();
		const items = await filtered
			.selectAll()
			.orderBy("created_at", "desc")
			.limit(input.pageSize)
			.offset((input.page - 1) * input.pageSize)
			.execute();

		return {
			items,
			total: Number(totalRow?.total ?? 0),
		};
	},

	record: (input: PromptHistoryRecordInput) =>
		db
			.insertInto("prompt_history")
			.values({
				id: crypto.randomUUID(),
				...promptHistoryValues(input),
				created_at: Date.now(),
			} as prompt_history)
			.executeTakeFirst(),

	create: async (input: PromptHistoryCreateInput) => {
		const id = crypto.randomUUID();

		await db
			.insertInto("prompt_history")
			.values({
				id,
				...promptHistoryValues(input),
				created_at: Date.now(),
			} as prompt_history)
			.executeTakeFirst();

		return dbPromptHistory.getById(id);
	},

	update: (input: PromptHistoryUpdateInput) => {
		const { id, ...values } = input;
		const cleanValues = cleanUpdate({
			kind: values.kind,
			text: values.text,
			prompt: values.prompt,
			target: values.target,
			agent_slug: values.agentSlug,
			skill_slug: values.skillSlug,
			project_id: values.projectId,
			project_name: values.projectName,
			route_path: values.routePath,
			model: values.model,
			effort: values.effort,
		});

		return db
			.updateTable("prompt_history")
			.set(cleanValues)
			.where("id", "=", id)
			.executeTakeFirst();
	},
};
