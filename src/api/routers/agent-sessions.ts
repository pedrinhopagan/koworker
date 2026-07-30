import { stat } from "node:fs/promises";
import { ORPCError } from "@orpc/server";

import { pendingInteraction } from "@/lib/agent-session";
import { protectedProcedure } from "../auth/context";
import { dbAgentSessions } from "../db/agent-sessions";
import { dbExecutionRuns } from "../db/execution-runs";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import {
	answerQuestion,
	endSession,
	interruptSession,
	isSessionBusy,
	listSessionEvents,
	respondPermission,
	resumeSession,
	sendTurn,
	setPermissionMode,
	startSession,
} from "../helpers/agent-session/registry";
import { createTask, taskAutoTitleInstruction } from "../helpers/task-creation";
import {
	AgentSessionAnswerSchema,
	AgentSessionClearSchema,
	AgentSessionIdSchema,
	AgentSessionListSchema,
	AgentSessionModeSchema,
	AgentSessionPermissionSchema,
	AgentSessionStartSchema,
	AgentSessionTurnSchema,
} from "../schemas";

// O agente trabalha no diretório do projeto: se ele não existe mais no disco, a sessão sobe no
// lugar errado ou nem sobe. Vale para o start e para o retomar, onde o projeto pode ter mudado.
async function assertWorkingDirectory(path: string) {
	const stats = await stat(path).catch(() => null);
	if (!stats?.isDirectory()) {
		throw new ORPCError("BAD_REQUEST", {
			message: `O diretório do projeto não existe no disco: ${path}`,
		});
	}
}

async function loadSession(sessionId: string, userId: number) {
	const session = await dbAgentSessions.getByIdForUser(sessionId, userId);
	if (!session) {
		throw new ORPCError("NOT_FOUND", { message: "Sessão não encontrada" });
	}

	return session;
}

// A conversa inteira num payload só: é o que a rota abre e o que o `start` devolve, para o chat
// aparecer com a primeira mensagem já dentro em vez de piscar um carregamento.
async function sessionDetail(sessionId: string, userId: number) {
	const session = await dbAgentSessions.getDetailedByIdForUser(sessionId, userId);
	if (!session) {
		throw new ORPCError("NOT_FOUND", { message: "Sessão não encontrada" });
	}

	const events = await listSessionEvents(session.id);

	return {
		id: session.id,
		status: session.status,
		busy: isSessionBusy(session.id),
		title: session.title,
		cli: session.cli,
		cwd: session.cwd,
		permissionMode: session.permission_mode,
		startedAt: session.started_at,
		projectId: session.project_id,
		projectName: session.project_name ?? "Projeto removido",
		projectMainRoute: session.project_main_route ?? null,
		resumable: session.project_main_route === session.cwd,
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
	start: protectedProcedure.input(AgentSessionStartSchema).handler(async ({ input, context }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project?.main_route) {
			throw new ORPCError("NOT_FOUND", { message: "Projeto não encontrado" });
		}
		await assertWorkingDirectory(project.main_route);

		const existing = input.taskId ? await dbTasks.getById(input.taskId) : null;
		if (input.taskId && existing?.project_id !== project.id) {
			throw new ORPCError("NOT_FOUND", { message: "Tarefa não encontrada" });
		}

		const created =
			input.createTaskTitle === undefined
				? null
				: await createTask({
						projectId: project.id,
						...(input.createTaskTitle ? { title: input.createTaskTitle } : {}),
						complexity: "medio",
						seed: true,
					});
		const task = created ?? existing;

		// A cabeça `/kw <tarefa>` é o que dá ao agente a pasta da tarefa para ler e escrever. Sem
		// tarefa (execução solta da barra de prompt) o texto vai como veio.
		const prompt = task
			? [
					`${input.cli === "codex" ? "$kw" : "/kw"} ${task.folder_path}/index.md`,
					...(created && !input.createTaskTitle ? [taskAutoTitleInstruction(created.id)] : []),
					input.prompt,
				].join("\n\n")
			: input.prompt;

		const session = await startSession({
			userId: context.user.id,
			projectId: project.id,
			title: task?.title ?? project.name,
			cli: input.cli,
			cwd: project.main_route,
			permissionMode: input.cli === "codex" ? input.approvalMode : input.permissionMode,
			...(task ? { taskId: task.id } : {}),
			...(input.model ? { model: input.model } : {}),
			...(input.effort ? { effort: input.effort } : {}),
			...(input.agent ? { agent: input.agent } : {}),
		});

		await sendTurn({
			session,
			prompt,
			inputKind: input.inputKind,
			...(input.originalPrompt ? { originalPrompt: input.originalPrompt } : {}),
		});

		return sessionDetail(session.id, context.user.id);
	}),

	get: protectedProcedure
		.input(AgentSessionIdSchema)
		.handler(({ input, context }) => sessionDetail(input.sessionId, context.user.id)),

	list: protectedProcedure.input(AgentSessionListSchema).handler(async ({ input, context }) => {
		const rows = await dbAgentSessions.listForUser(context.user.id, input.limit);

		return rows.map((row) => ({
			id: row.id,
			status: row.status,
			busy: isSessionBusy(row.id),
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

	turn: protectedProcedure.input(AgentSessionTurnSchema).handler(async ({ input, context }) => {
		const session = await loadSession(input.sessionId, context.user.id);

		return sendTurn({
			session,
			prompt: input.prompt,
			inputKind: input.inputKind,
			...(input.originalPrompt ? { originalPrompt: input.originalPrompt } : {}),
		});
	}),

	// Retomar é `--resume` no mesmo id: o histórico do CLI e os blocos já gravados continuam de pé.
	resume: protectedProcedure.input(AgentSessionIdSchema).handler(async ({ input, context }) => {
		const session = await loadSession(input.sessionId, context.user.id);
		if (session.status === "live") {
			return { sessionId: session.id };
		}

		const project = await dbProjects.getById(session.project_id);
		if (project?.main_route !== session.cwd) {
			throw new ORPCError("BAD_REQUEST", {
				message: "O projeto mudou de diretório desde o início desta sessão. Abra uma nova.",
			});
		}
		await assertWorkingDirectory(session.cwd);
		await resumeSession(session);

		return { sessionId: session.id };
	}),

	permission: protectedProcedure
		.input(AgentSessionPermissionSchema)
		.handler(async ({ input, context }) => {
			await loadSession(input.sessionId, context.user.id);
			await respondPermission({
				sessionId: input.sessionId,
				requestId: input.requestId,
				decision: input.decision,
				...(input.reason ? { reason: input.reason } : {}),
			});

			return { ok: true };
		}),

	answer: protectedProcedure.input(AgentSessionAnswerSchema).handler(async ({ input, context }) => {
		await loadSession(input.sessionId, context.user.id);
		await answerQuestion({
			sessionId: input.sessionId,
			questionId: input.questionId,
			answers: input.answers,
			...(input.freeText ? { freeText: input.freeText } : {}),
		});

		return { ok: true };
	}),

	interrupt: protectedProcedure.input(AgentSessionIdSchema).handler(async ({ input, context }) => {
		await loadSession(input.sessionId, context.user.id);
		await interruptSession(input.sessionId);

		return { ok: true };
	}),

	end: protectedProcedure.input(AgentSessionIdSchema).handler(async ({ input, context }) => {
		await loadSession(input.sessionId, context.user.id);
		await endSession(input.sessionId, "A sessão foi encerrada por você.");

		return { ok: true };
	}),

	setPermissionMode: protectedProcedure
		.input(AgentSessionModeSchema)
		.handler(async ({ input, context }) => {
			await loadSession(input.sessionId, context.user.id);
			await setPermissionMode(input.sessionId, input.permissionMode);

			return { ok: true };
		}),

	clear: protectedProcedure.input(AgentSessionClearSchema).handler(async ({ input, context }) => {
		const cleared = await dbAgentSessions.softDeleteForUser(input.sessionIds, context.user.id);

		return { cleared };
	}),

	// A rota antiga da conversa navegava por runId; a notificação de uma execução antiga ainda aponta
	// pra lá. Traduzir aqui evita quebrar links já disparados.
	resolveRun: protectedProcedure.input(AgentSessionIdSchema).handler(async ({ input, context }) => {
		const run = await dbExecutionRuns.getByIdForUser(input.sessionId, context.user.id);

		return { sessionId: run?.session_id ?? null, runId: run?.id ?? null };
	}),
};
