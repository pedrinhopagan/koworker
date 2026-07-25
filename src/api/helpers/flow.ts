import { ORPCError } from "@orpc/server";

import {
	COMPLEXITY_FLOWS,
	STAGE_AGENT,
	type TaskComplexity,
	type TaskStage,
} from "@/constants/complexity";
import { buildKoworkerPrompt } from "@/lib/build-prompt";
import type { execution_runs, projects, tasks } from "../db/connection";
import { dbExecutionRuns } from "../db/execution-runs";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { type FlowEvent, PubSub } from "../pubsub";
import { PushNotifications } from "./push-notifications";
import { releaseRun, trackRun } from "./run-registry";
import { spawnCapture } from "./spawn";
import { inferTaskStage, readTaskFolderMeta } from "./task-folder";
import { withProjectStorageLock } from "./task-storage-coordinator";

// Teto por etapa: execução e orquestração (o orquestrador roda várias fases num só passe) são
// ordens de grandeza mais longas que os 60s do autofill. 45min é generoso o bastante para uma etapa
// real sem deixar um processo zumbi eterno se o headless travar.
const STAGE_TIMEOUT_MS = 45 * 60_000;

export const FLOW_TIMEOUT_MS =
	(Math.max(...Object.values(COMPLEXITY_FLOWS).map((stages) => stages.length)) + 1) *
	STAGE_TIMEOUT_MS;

// Agente que fecha a tarefa quando o fluxo da complexidade termina — revisão final voltada pro
// koworker, fora de COMPLEXITY_FLOWS (que só descreve as etapas internas).
const FINAL_AGENT = "revisor-tarefa";

const running = new Set<string>();

function flowEventFromRun(run: execution_runs): FlowEvent {
	const status =
		run.status === "done"
			? "completed"
			: run.status === "waiting_user"
				? "waiting-user"
				: run.status === "timeout" || run.status === "cancelled"
					? "failed"
					: run.status;

	return {
		taskId: run.task_id ?? "",
		status,
		stage: (run.stage as TaskStage | null | undefined) ?? null,
		agent: run.agent ?? null,
		message: run.error ?? null,
	};
}

function runStatusFromEvent(status: FlowEvent["status"]): execution_runs["status"] {
	if (status === "completed") {
		return "done";
	}
	if (status === "waiting-user") {
		return "waiting_user";
	}

	return status;
}

async function emit(params: {
	executionId: string;
	userId: number;
	taskTitle: string;
	event: FlowEvent;
	runStatus?: execution_runs["status"];
}): Promise<boolean> {
	const status = params.runStatus ?? runStatusFromEvent(params.event.status);
	const terminal = params.event.status !== "running";
	const changes = {
		status,
		stage: params.event.stage,
		agent: params.event.agent,
		error: params.event.message,
	};

	const written = terminal
		? await dbExecutionRuns.finishIfRunning(params.executionId, changes)
		: await dbExecutionRuns.updateIfRunning(params.executionId, changes);
	if (!written) {
		return false;
	}

	const { event } = params;
	await PubSub.publish("flow", event.taskId, event);

	if (terminal) {
		void PushNotifications.send(params.userId, {
			title:
				params.event.status === "completed"
					? "Fluxo concluído"
					: params.event.status === "waiting-user"
						? "Fluxo aguardando você"
						: "Fluxo precisa de atenção",
			body: params.event.message ?? params.taskTitle,
			url: `/tarefas/${params.event.taskId}`,
			tag: `flow-${params.executionId}`,
		}).catch(() => {});
	}

	return true;
}

export async function finishFlowRunExternally(
	run: execution_runs,
	params: { status: "failed" | "timeout" | "cancelled"; message: string },
) {
	await emit({
		executionId: run.id,
		userId: run.user_id,
		taskTitle: run.title,
		event: {
			taskId: run.task_id ?? "",
			status: "failed",
			stage: (run.stage as TaskStage | null | undefined) ?? null,
			agent: run.agent ?? null,
			message: params.message,
		},
		runStatus: params.status,
	});
}

// Spawna uma etapa headless: `/kw <pasta> [complexidade: X]` forçando o agente da etapa, com
// `acceptEdits` pra ele poder gravar artefatos e código sem parar em cada permissão. Sucesso é
// exitCode 0; timeout e código != 0 viram falha com o fato que a diferencia.
async function runAgent(params: {
	agent: string;
	folderPath: string;
	complexity: TaskComplexity;
	cwd: string;
	interactionMode: "unattended" | "interactive";
	signal: AbortSignal;
}): Promise<{ success: true } | { success: false; message: string; cancelled: boolean }> {
	const prompt = buildKoworkerPrompt({
		kw: true,
		target: params.folderPath,
		text:
			params.interactionMode === "unattended"
				? "Trabalhe de forma não assistida até um desfecho. Não faça perguntas nem espere respostas; registre decisões razoáveis no artefato da etapa."
				: "",
		complexity: params.complexity,
	});

	const { exitCode, timedOut, cancelled } = await spawnCapture({
		cmd: ["claude", "-p", prompt, "--agent", params.agent, "--permission-mode", "acceptEdits"],
		cwd: params.cwd,
		timeoutMs: STAGE_TIMEOUT_MS,
		signal: params.signal,
	});

	if (cancelled) {
		return { success: false, cancelled: true, message: "O fluxo foi cancelado." };
	}
	if (timedOut) {
		return {
			success: false,
			cancelled: false,
			message: `A etapa "${params.agent}" excedeu o tempo limite.`,
		};
	}
	if (exitCode !== 0) {
		return {
			success: false,
			cancelled: false,
			message: `A etapa "${params.agent}" falhou (código ${exitCode}).`,
		};
	}

	return { success: true };
}

async function stableTask(project: projects, task: tasks) {
	const current = await withProjectStorageLock(
		{ projectId: project.id, projectRoute: project.main_route, task },
		() => dbTasks.getById(task.id),
	);
	if (!current) {
		throw new Error("A tarefa deste fluxo não existe mais");
	}

	return current;
}

// Loop determinístico: re-infere a etapa pelos artefatos em disco a cada volta, roda o agente dela,
// e segue até o fluxo esvaziar — então fecha com o revisor da tarefa. Para no grill (interativo) e
// em qualquer falha. `lastRan` corta o loop infinito se uma etapa terminar sem gravar seu artefato.
async function execute(params: {
	row: tasks;
	project: projects;
	executionId: string;
	userId: number;
	interactionMode: "unattended" | "interactive";
	signal: AbortSignal;
}): Promise<void> {
	const { project } = params;
	const complexity = params.row.complexity as TaskComplexity;
	const cwd = project.main_route;
	let row = params.row;
	const publish = (event: FlowEvent, runStatus?: execution_runs["status"]) =>
		emit({
			executionId: params.executionId,
			userId: params.userId,
			taskTitle: row.title ?? row.folder_path,
			event,
			...(runStatus ? { runStatus } : {}),
		});

	let lastRan: TaskStage | null = null;
	while (true) {
		row = await stableTask(project, row);
		const meta = await readTaskFolderMeta({ projectRoute: cwd, folderPath: row.folder_path });
		const stage = inferTaskStage({ fileNames: meta.fileNames, complexity });
		if (stage === null) {
			break;
		}

		const agent = STAGE_AGENT[stage];

		if (params.signal.aborted) {
			await publish(
				{ taskId: row.id, status: "failed", stage, agent, message: "O fluxo foi cancelado." },
				"cancelled",
			);
			return;
		}

		if (stage === "grill" && params.interactionMode === "interactive") {
			await publish({
				taskId: row.id,
				status: "waiting-user",
				stage,
				agent,
				message: "O grill é interativo: conduza-o com o usuário antes de retomar o fluxo.",
			});
			return;
		}

		if (stage === lastRan) {
			await publish({
				taskId: row.id,
				status: "failed",
				stage,
				agent,
				message: `A etapa "${stage}" terminou sem gravar seu artefato.`,
			});
			return;
		}

		const alive = await publish({
			taskId: row.id,
			status: "running",
			stage,
			agent,
			message: null,
		});
		if (!alive) {
			return;
		}

		const result = await runAgent({
			agent,
			folderPath: row.folder_path,
			complexity,
			cwd,
			interactionMode: params.interactionMode,
			signal: params.signal,
		});
		if (!result.success) {
			await publish(
				{ taskId: row.id, status: "failed", stage, agent, message: result.message },
				result.cancelled ? "cancelled" : "failed",
			);
			return;
		}

		lastRan = stage;
	}

	if (params.signal.aborted) {
		await publish(
			{
				taskId: row.id,
				status: "failed",
				stage: null,
				agent: FINAL_AGENT,
				message: "O fluxo foi cancelado.",
			},
			"cancelled",
		);
		return;
	}

	row = await stableTask(project, row);

	const aliveForReview = await publish({
		taskId: row.id,
		status: "running",
		stage: null,
		agent: FINAL_AGENT,
		message: null,
	});
	if (!aliveForReview) {
		return;
	}

	const review = await runAgent({
		agent: FINAL_AGENT,
		folderPath: row.folder_path,
		complexity,
		cwd,
		interactionMode: params.interactionMode,
		signal: params.signal,
	});
	if (!review.success) {
		await publish(
			{
				taskId: row.id,
				status: "failed",
				stage: null,
				agent: FINAL_AGENT,
				message: review.message,
			},
			review.cancelled ? "cancelled" : "failed",
		);
		return;
	}

	await publish({ taskId: row.id, status: "completed", stage: null, agent: null, message: null });
}

export const TaskFlow = {
	// Dispara o fluxo em segundo plano e volta na hora. Um segundo disparo pro mesmo taskId é ignorado
	// (`started: false`). Erros inesperados do loop viram um evento de falha em vez de rejeição solta.
	async run(taskId: string, userId: number, interactionMode: "unattended" | "interactive") {
		if (running.has(taskId)) {
			const current = await dbExecutionRuns.getLatestFlowForTask(taskId, userId);
			return { started: false, event: current ? flowEventFromRun(current) : null };
		}

		const row = await dbTasks.getById(taskId);
		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "Tarefa não encontrada" });
		}

		const project = await dbProjects.getById(row.project_id);
		if (!project) {
			throw new ORPCError("NOT_FOUND", { message: "Projeto não encontrado" });
		}

		const executionId = crypto.randomUUID();
		const startedAt = Date.now();
		await dbExecutionRuns.create({
			id: executionId,
			user_id: userId,
			project_id: project.id,
			task_id: row.id,
			kind: "flow",
			title: row.title ?? row.folder_path,
			status: "running",
			interaction_mode: interactionMode,
			started_at: startedAt,
			updated_at: startedAt,
			heartbeat_at: startedAt,
		});
		running.add(taskId);
		const controller = trackRun(executionId);
		const initial: FlowEvent = {
			taskId,
			status: "running",
			stage: null,
			agent: null,
			message: null,
		};
		await PubSub.publish("flow", taskId, initial);

		void execute({
			row,
			project,
			executionId,
			userId,
			interactionMode,
			signal: controller.signal,
		})
			.catch((err) =>
				emit({
					executionId,
					userId,
					taskTitle: row.title ?? row.folder_path,
					event: {
						taskId,
						status: "failed",
						stage: null,
						agent: null,
						message: err instanceof Error ? err.message : "Erro inesperado no fluxo",
					},
				}),
			)
			.finally(() => {
				running.delete(taskId);
				releaseRun(executionId);
			});

		return { started: true, event: initial };
	},

	async status(taskId: string, userId: number) {
		const current = await dbExecutionRuns.getLatestFlowForTask(taskId, userId);
		return {
			running: running.has(taskId) || current?.status === "running",
			event: current ? flowEventFromRun(current) : null,
		};
	},
};
