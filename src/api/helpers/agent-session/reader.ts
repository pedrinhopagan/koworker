import { parseAgentEventPayload } from "@/lib/agent-session";
import { dbAgentEvents } from "../../db/agent-events";

export async function listLegacySessionEvents(sessionId: string) {
	const rows = await dbAgentEvents.listForSession(sessionId);

	return rows.map((row) =>
		Object.assign(
			{
				id: row.id,
				sessionId: row.session_id,
				seq: row.seq,
				at: row.updated_at ?? row.created_at,
				payload: parseAgentEventPayload(row.payload),
			},
			row.run_id ? { runId: row.run_id } : {},
		),
	);
}
