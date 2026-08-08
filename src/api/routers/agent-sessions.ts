import { ORPCError } from "@orpc/server";

import { pendingInteraction } from "@/lib/agent-session";
import { protectedProcedure } from "../auth/context";
import { dbAgentSessions } from "../db/agent-sessions";
import { dbExecutionRuns } from "../db/execution-runs";
import { listLegacySessionEvents } from "../helpers/agent-session/reader";
import { AgentSessionIdSchema, AgentSessionListSchema } from "../schemas";

async function sessionDetail(sessionId: string, userId: number) {
	const session = await dbAgentSessions.getDetailedByIdForUser(sessionId, userId);
	if (!session) {
		throw new ORPCError("NOT_FOUND", { message: "Sessão não encontrada" });
	}

	const events = await listLegacySessionEvents(session.id);

	return {
		id: session.id,
		status: session.status,
		busy: false,
		title: session.title,
		cli: session.cli,
		cwd: session.cwd,
		permissionMode: session.permission_mode,
		startedAt: session.started_at,
		projectId: session.project_id,
		projectName: session.project_name ?? "Projeto removido",
		projectMainRoute: session.project_main_route ?? null,
		resumable: false,
		pending: pendingInteraction(events),
		events,
		...(session.model ? { model: session.model } : {}),
		...(session.effort ? { effort: session.effort } : {}),
		...(session.agent ? { agent: session.agent } : {}),
		...(session.task_id ? { taskId: session.task_id } : {}),
		...(session.task_title ? { taskTitle: session.task_title } : {}),
		...(session.ended_at ? { endedAt: session.ended_at } : {}),
		...(session.end_reason ? { endReason: session.end_reason } : {}),
	};
}

export const agentSessionsRouter = {
	get: protectedProcedure
		.input(AgentSessionIdSchema)
		.handler(({ input, context }) => sessionDetail(input.sessionId, context.user.id)),

	list: protectedProcedure.input(AgentSessionListSchema).handler(async ({ input, context }) => {
		const rows = await dbAgentSessions.listForUser(context.user.id, input.limit);

		return rows.map((row) => ({
			id: row.id,
			status: row.status,
			busy: false,
			title: row.title,
			cli: row.cli,
			startedAt: row.started_at,
			projectName: row.project_name ?? "Projeto removido",
			taskId: row.task_id,
			taskTitle: row.task_title,
			model: row.model,
			endedAt: row.ended_at,
		}));
	}),

	resolveRun: protectedProcedure.input(AgentSessionIdSchema).handler(async ({ input, context }) => {
		const run = await dbExecutionRuns.getByIdForUser(input.sessionId, context.user.id);

		return { sessionId: run?.session_id ?? null, runId: run?.id ?? null };
	}),
};
