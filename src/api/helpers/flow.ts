import { ORPCError } from "@orpc/server";

import { STAGE_AGENT, type TaskComplexity, type TaskStage } from "@/constants/complexity";
import { buildKoworkerPrompt } from "@/lib/build-prompt";
import type { projects, tasks } from "../db/connection";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { type FlowEvent, PubSub } from "../pubsub";
import { spawnCapture } from "./spawn";
import { inferTaskStage, readTaskFolderMeta } from "./task-folder";

// Teto por etapa: execução e orquestração (o orquestrador roda várias fases num só passe) são
// ordens de grandeza mais longas que os 60s do autofill. 45min é generoso o bastante para uma etapa
// real sem deixar um processo zumbi eterno se o headless travar.
const STAGE_TIMEOUT_MS = 45 * 60_000;

// Agente que fecha a tarefa quando o fluxo da complexidade termina — revisão final voltada pro
// koworker, fora de COMPLEXITY_FLOWS (que só descreve as etapas internas).
const FINAL_AGENT = "revisor-tarefa";

// Runs em andamento por taskId: um disparo para um taskId já rodando é ignorado. Vive só em memória
// (o runner é um processo único e longo); reiniciar o backend zera, o que é correto — o processo
// headless morreria junto.
const running = new Set<string>();

// Último evento publicado por tarefa, pra `status` hidratar a tela reaberta no meio de um run (ou
// mostrar o desfecho terminal depois que ele saiu de `running`).
const lastEvent = new Map<string, FlowEvent>();

async function emit(event: FlowEvent): Promise<void> {
	lastEvent.set(event.taskId, event);
	await PubSub.publish("flow", event.taskId, event);
}

// Spawna uma etapa headless: `/kw <pasta> [complexidade: X]` forçando o agente da etapa, com
// `acceptEdits` pra ele poder gravar artefatos e código sem parar em cada permissão. Sucesso é
// exitCode 0; timeout e código != 0 viram falha com o fato que a diferencia.
async function runAgent(params: {
	agent: string;
	folderPath: string;
	complexity: TaskComplexity;
	cwd: string;
}): Promise<{ success: true } | { success: false; message: string }> {
	const prompt = buildKoworkerPrompt({
		kw: true,
		target: params.folderPath,
		text: "",
		complexity: params.complexity,
	});

	const { exitCode, timedOut } = await spawnCapture({
		cmd: ["claude", "-p", prompt, "--agent", params.agent, "--permission-mode", "acceptEdits"],
		cwd: params.cwd,
		timeoutMs: STAGE_TIMEOUT_MS,
	});

	if (timedOut) {
		return { success: false, message: `A etapa "${params.agent}" excedeu o tempo limite.` };
	}
	if (exitCode !== 0) {
		return { success: false, message: `A etapa "${params.agent}" falhou (código ${exitCode}).` };
	}

	return { success: true };
}

// Loop determinístico: re-infere a etapa pelos artefatos em disco a cada volta, roda o agente dela,
// e segue até o fluxo esvaziar — então fecha com o revisor da tarefa. Para no grill (interativo) e
// em qualquer falha. `lastRan` corta o loop infinito se uma etapa terminar sem gravar seu artefato.
async function execute(params: { row: tasks; project: projects }): Promise<void> {
	const { row, project } = params;
	const complexity = row.complexity as TaskComplexity;
	const cwd = project.main_route;

	let lastRan: TaskStage | null = null;
	while (true) {
		const meta = await readTaskFolderMeta({ projectRoute: cwd, folderPath: row.folder_path });
		const stage = inferTaskStage({ fileNames: meta.fileNames, complexity });
		if (stage === null) {
			break;
		}

		const agent = STAGE_AGENT[stage];

		if (stage === "grill") {
			await emit({
				taskId: row.id,
				status: "waiting-user",
				stage,
				agent,
				message: "O grill é interativo: conduza-o com o usuário antes de retomar o fluxo.",
			});
			return;
		}

		if (stage === lastRan) {
			await emit({
				taskId: row.id,
				status: "failed",
				stage,
				agent,
				message: `A etapa "${stage}" terminou sem gravar seu artefato.`,
			});
			return;
		}

		await emit({ taskId: row.id, status: "running", stage, agent, message: null });

		const result = await runAgent({ agent, folderPath: row.folder_path, complexity, cwd });
		if (!result.success) {
			await emit({ taskId: row.id, status: "failed", stage, agent, message: result.message });
			return;
		}

		lastRan = stage;
	}

	await emit({ taskId: row.id, status: "running", stage: null, agent: FINAL_AGENT, message: null });

	const review = await runAgent({
		agent: FINAL_AGENT,
		folderPath: row.folder_path,
		complexity,
		cwd,
	});
	if (!review.success) {
		await emit({
			taskId: row.id,
			status: "failed",
			stage: null,
			agent: FINAL_AGENT,
			message: review.message,
		});
		return;
	}

	await emit({ taskId: row.id, status: "completed", stage: null, agent: null, message: null });
}

export const TaskFlow = {
	// Dispara o fluxo em segundo plano e volta na hora. Um segundo disparo pro mesmo taskId é ignorado
	// (`started: false`). Erros inesperados do loop viram um evento de falha em vez de rejeição solta.
	async run(taskId: string) {
		if (running.has(taskId)) {
			return { started: false, event: lastEvent.get(taskId) ?? null };
		}

		const row = await dbTasks.getById(taskId);
		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "Tarefa não encontrada" });
		}

		const project = await dbProjects.getById(row.project_id);
		if (!project) {
			throw new ORPCError("NOT_FOUND", { message: "Projeto não encontrado" });
		}

		running.add(taskId);
		const initial: FlowEvent = {
			taskId,
			status: "running",
			stage: null,
			agent: null,
			message: null,
		};
		await emit(initial);

		void execute({ row, project })
			.catch((err) =>
				emit({
					taskId,
					status: "failed",
					stage: null,
					agent: null,
					message: err instanceof Error ? err.message : "Erro inesperado no fluxo",
				}),
			)
			.finally(() => {
				running.delete(taskId);
			});

		return { started: true, event: initial };
	},

	status(taskId: string) {
		return { running: running.has(taskId), event: lastEvent.get(taskId) ?? null };
	},
};
