import type { PromptHistoryRecordInput } from "../schemas/prompt-history";
import { db, type prompt_history } from "./connection";

export const dbPromptHistory = {
	// Append-only: cada disparo é uma linha nova. created_at em epoch-ms aqui, nunca o default
	// "now" do arktype (que grava segundos) — a análise futura ordena por este campo.
	record: (input: PromptHistoryRecordInput) =>
		db
			.insertInto("prompt_history")
			.values({
				id: crypto.randomUUID(),
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
				created_at: Date.now(),
			} as prompt_history)
			.executeTakeFirst(),
};
