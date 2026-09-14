import { sql, type Insertable } from "kysely";

import type { CliSessionFile } from "../helpers/agent-history/paths";
import type { PromptCopyInput, PromptHistoryListInput } from "../schemas/prompt-history";
import { db, type prompts } from "./connection";

export type PromptRow = Insertable<prompts>;

const INSERT_CHUNK = 500;

function filtered(input: PromptHistoryListInput) {
	let query = db.selectFrom("prompts");

	if (input.source) {
		query = query.where("source", "=", input.source);
	}
	if (input.projectId) {
		query = query.where("project_id", "=", input.projectId);
	}
	if (input.q) {
		const term = `%${input.q.toLowerCase()}%`;
		query = query.where(sql<boolean>`
			(
			lower(prompt) like ${term}
			or lower(coalesce(project_name, '')) like ${term}
			or lower(coalesce(cwd, '')) like ${term}
			)
		`);
	}

	return query;
}

export const dbPrompts = {
	transcriptSizes: async () =>
		new Map(
			(await db.selectFrom("prompt_transcripts").select(["path", "size_bytes"]).execute()).map(
				(row) => [row.path, row.size_bytes] as const,
			),
		),

	replaceTranscript: (file: CliSessionFile, rows: PromptRow[]) =>
		db.transaction().execute(async (trx) => {
			await trx.deleteFrom("prompts").where("transcript_path", "=", file.path).execute();
			for (let start = 0; start < rows.length; start += INSERT_CHUNK) {
				await trx
					.insertInto("prompts")
					.values(rows.slice(start, start + INSERT_CHUNK))
					.execute();
			}
			await trx
				.insertInto("prompt_transcripts")
				.values({ path: file.path, size_bytes: file.sizeBytes, indexed_at: Date.now() })
				.onConflict((oc) =>
					oc.column("path").doUpdateSet({ size_bytes: file.sizeBytes, indexed_at: Date.now() }),
				)
				.execute();
		}),

	recordCopy: (input: PromptCopyInput) =>
		db
			.insertInto("prompts")
			.values({
				id: crypto.randomUUID(),
				source: "copy",
				prompt: input.prompt,
				norm: input.norm,
				project_id: input.projectId ?? null,
				project_name: input.projectName ?? null,
				sent_at: Date.now(),
				created_at: Date.now(),
			})
			.execute(),

	// Uma entrada por prompt normalizado, com todos os envios dele por trás: a página é decidida
	// nos grupos e só as linhas dos grupos da página são lidas.
	list: async (input: PromptHistoryListInput) => {
		const groups = filtered(input)
			.select(["norm", sql<number>`max(sent_at)`.as("last_sent_at")])
			.groupBy("norm");
		const totalRow = await db
			.selectFrom(groups.as("g"))
			.select(sql<number>`count(*)`.as("total"))
			.executeTakeFirst();
		const page = await groups
			.orderBy("last_sent_at", "desc")
			.limit(input.pageSize)
			.offset((input.page - 1) * input.pageSize)
			.execute();
		const rows =
			page.length === 0
				? []
				: await filtered(input)
						.selectAll()
						.where(
							"norm",
							"in",
							page.map((group) => group.norm),
						)
						.orderBy("sent_at", "desc")
						.execute();

		return {
			total: Number(totalRow?.total ?? 0),
			groups: page.map((group) => rows.filter((row) => row.norm === group.norm)),
		};
	},
};
