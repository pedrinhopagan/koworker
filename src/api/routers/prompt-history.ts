import { protectedProcedure } from "../auth/context";
import type { prompts } from "../db/connection";
import { dbPrompts } from "../db/prompts";
import { syncPromptIndex } from "../helpers/agent-history/prompt-index";
import {
	PromptCopySchema,
	PromptHistoryListSchema,
	type PromptSource,
} from "../schemas/prompt-history";

// A varredura incremental costuma levar milissegundos (só transcript que cresceu é relido). A primeira
// depois do boot pode levar mais: a lista não espera por ela além disso e mostra o que já está indexado.
const SYNC_WAIT_MS = 1500;

function describeGroup(rows: prompts[]) {
	const latest = rows[0];
	const sources = new Map<PromptSource, number>();
	for (const row of rows) {
		sources.set(row.source, (sources.get(row.source) ?? 0) + 1);
	}
	const session = rows.find((row) => row.session_id && row.source !== "copy");

	return {
		id: latest.id,
		prompt: latest.prompt,
		lastSentAt: latest.sent_at,
		firstSentAt: rows.at(-1)?.sent_at ?? latest.sent_at,
		sends: rows.length,
		sources: [...sources].map(([source, count]) => ({ source, count })),
		projectName: rows.find((row) => row.project_name)?.project_name ?? null,
		cwd: rows.find((row) => row.cwd)?.cwd ?? null,
		session:
			session?.session_id && session.source !== "copy"
				? { cli: session.source, sessionId: session.session_id }
				: null,
	};
}

export const promptHistoryRouter = {
	list: protectedProcedure.input(PromptHistoryListSchema).handler(async ({ input }) => {
		await Promise.race([syncPromptIndex(), Bun.sleep(SYNC_WAIT_MS)]);
		const result = await dbPrompts.list(input);

		return {
			items: result.groups.filter((rows) => rows.length > 0).map(describeGroup),
			total: result.total,
			page: input.page,
			pageSize: input.pageSize,
			totalPages: Math.max(1, Math.ceil(result.total / input.pageSize)),
		};
	}),

	recordCopy: protectedProcedure.input(PromptCopySchema).handler(async ({ input }) => {
		await dbPrompts.recordCopy(input);
		return { success: true };
	}),
};
