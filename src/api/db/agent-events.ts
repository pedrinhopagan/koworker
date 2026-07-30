import type { AgentEventKind } from "@/lib/agent-session";
import { db } from "./connection";

type AgentEventCreate = {
	id: string;
	session_id: string;
	run_id?: string;
	seq: number;
	kind: AgentEventKind;
	payload: string;
	created_at: number;
};

export const dbAgentEvents = {
	async create(input: AgentEventCreate) {
		await db.insertInto("agent_events").values(input).execute();
	},

	async updatePayload(id: string, payload: string) {
		await db
			.updateTable("agent_events")
			.set({ payload, updated_at: Date.now() })
			.where("id", "=", id)
			.execute();
	},

	listForSession(sessionId: string) {
		return db
			.selectFrom("agent_events")
			.selectAll()
			.where("session_id", "=", sessionId)
			.orderBy("seq", "asc")
			.execute();
	},

	async nextSeq(sessionId: string) {
		const row = await db
			.selectFrom("agent_events")
			.select(({ fn }) => fn.max<number>("seq").as("max_seq"))
			.where("session_id", "=", sessionId)
			.executeTakeFirst();

		return (row?.max_seq ?? 0) + 1;
	},
};
