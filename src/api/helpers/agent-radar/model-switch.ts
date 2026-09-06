import { ORPCError } from "@orpc/server";

import type { RadarAgent } from "@/api/schemas/terminal-workspace";
import { agentRadarAgentLabel, agentRadarCli } from "@/constants/agent-radar";
import type { AgentSessionEvent } from "@/lib/agent-session";
import { dbProjects } from "../../db/projects";
import { kwTerminalPaneClose, kwTerminalPaneRun } from "../terminal/kw-terminal";
import type { TerminalTabTarget } from "../terminal/names";
import { Terminal } from "../terminal/service";
import {
	HANDOFF_PROMPT,
	handoffOpeningPrompt,
	handoffQuestion,
	handoffSummary,
} from "./model-handoff";
import { getRadarAgent } from "./state";
import { openPaneTranscriptEffort, openPaneTranscriptModel } from "./transcript";
import { locateAgentTranscript } from "./transcript/locate";
import { syncPaneTranscriptSource } from "./transcript/sync";
import { openTranscriptTail } from "./transcript/tail";

export type ModelSwitchCli = "claude" | "codex";

export type ModelSwitchInput = {
	paneId: string;
	cli: ModelSwitchCli;
	model?: string;
	effort?: string;
	text: string;
};

// `moved`: a mesma conversa reabriu em outro pane, já com a mensagem entregue. `handoff`: a
// compactação começou e o desfecho chega por `handoffStatus`.
export type ModelSwitchResult = { kind: "moved"; paneId: string } | { kind: "handoff" };

export type HandoffJob = {
	phase: "compacting" | "starting" | "done" | "failed";
	cli: ModelSwitchCli;
	startedAt: number;
	paneId?: string;
	error?: string;
};

const POLL_MS = 500;
const AGENT_APPEAR_TIMEOUT_MS = 15_000;
// O CLI reporta o id da sessão ao daemon quando já está de pé; é o sinal de que o prompt do TUI
// aceita texto. Sem o reporte, o respiro maior cobre a subida.
const AGENT_READY_TIMEOUT_MS = 20_000;
const PROMPT_SETTLE_MS = 1_500;
const PROMPT_ACK_TIMEOUT_MS = 15_000;
const HANDOFF_ACK_TIMEOUT_MS = 20_000;
const HANDOFF_TIMEOUT_MS = 5 * 60_000;
const HANDOFF_JOB_TTL_MS = 10 * 60_000;

const handoffs = new Map<string, HandoffJob>();

function lastSeq(events: AgentSessionEvent[]) {
	return events.at(-1)?.seq ?? -1;
}

async function waitFor(check: () => boolean, timeoutMs: number, failure: string) {
	const deadline = Date.now() + timeoutMs;
	while (!check()) {
		if (Date.now() >= deadline) {
			throw new Error(failure);
		}
		await Bun.sleep(POLL_MS);
	}
}

function livePane(paneId: string) {
	const agent = getRadarAgent(paneId);
	if (!agent) {
		throw new Error("O pane fechou no meio da troca");
	}

	return agent;
}

async function projectFor(agent: RadarAgent) {
	const project = agent.projectId ? await dbProjects.getById(agent.projectId) : null;

	return { projectName: project?.name ?? null, mainRoute: project?.main_route ?? agent.cwd };
}

// A conversa que continua herda a tab da tarefa quando havia uma; senão ganha o rótulo antigo, que
// é como a pessoa a reconhece na lista.
function continuationTab(agent: RadarAgent): TerminalTabTarget {
	if (agent.taskId && agent.taskTitle) {
		return { kind: "task", taskId: agent.taskId, title: agent.taskTitle };
	}

	return { kind: "session", label: agent.tabLabel.replace(/^sess_/, "") };
}

// A mensagem não vai no argv: o codex corta o prompt inicial na primeira linha em branco, e o
// resumo de passagem é markdown com parágrafos. Ela entra pelo mesmo caminho do composer — colada
// no TUI já de pé — e a confirmação é o agent começar a trabalhar.
async function deliverPrompt(paneId: string, text: string) {
	await waitFor(
		() => getRadarAgent(paneId) !== null,
		AGENT_APPEAR_TIMEOUT_MS,
		"O novo pane abriu, mas o agent não apareceu na central",
	);
	await waitFor(
		() => livePane(paneId).sessionId !== null,
		AGENT_READY_TIMEOUT_MS,
		"O agent não reportou a sessão",
	).catch(() => Bun.sleep(PROMPT_SETTLE_MS));
	await Bun.sleep(PROMPT_SETTLE_MS);

	for (const attempt of [1, 2]) {
		await kwTerminalPaneRun(paneId, text);
		try {
			await waitFor(
				() => livePane(paneId).status === "working",
				PROMPT_ACK_TIMEOUT_MS,
				"O agent não recebeu a mensagem",
			);

			return;
		} catch (error) {
			if (attempt === 2) {
				throw error;
			}
		}
	}
}

// A mesma conversa reabre em outro pane com as flags novas: fecha o atual (dois processos na
// mesma sessão brigam pelo arquivo) e retoma pelo id. O que não mudou vem do transcript aberto,
// para a retomada não cair no padrão da config quando só o esforço (ou só o modelo) foi trocado.
async function reopen(agent: RadarAgent, input: ModelSwitchInput): Promise<ModelSwitchResult> {
	if (!agent.sessionId) {
		throw new ORPCError("PRECONDITION_FAILED", {
			message: "O CLI ainda não informou o id desta conversa; tente de novo em instantes",
		});
	}

	const model = input.model ?? openPaneTranscriptModel(agent.paneId);
	const effort = input.effort ?? openPaneTranscriptEffort(agent.paneId);
	const project = await projectFor(agent);
	if (!(await kwTerminalPaneClose(agent.paneId))) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Falha ao fechar o pane atual" });
	}

	const result = await Terminal.resumeSessionById({
		...project,
		cwd: agent.cwd,
		cli: input.cli,
		sessionId: agent.sessionId,
		options: {
			...(model ? { model } : {}),
			...(effort ? { effort } : {}),
			fullAccess: true,
			tab: continuationTab(agent),
		},
	});
	await deliverPrompt(result.paneId, input.text);

	return { kind: "moved", paneId: result.paneId };
}

// Pede ao agent atual o resumo de passagem e espera o turno terminar. O transcript é a fonte do
// texto; o status do daemon é o que diz que o turno acabou.
async function compactPane(agent: RadarAgent) {
	await syncPaneTranscriptSource(agent.paneId);
	const source = await locateAgentTranscript(livePane(agent.paneId));
	if (!source) {
		throw new Error("Esta conversa ainda não tem transcript para compactar");
	}

	const tail = await openTranscriptTail({
		sessionId: agent.paneId,
		source,
		onEvents: () => {},
		onError: () => {},
	});
	try {
		const baseline = lastSeq(tail.events());
		await kwTerminalPaneRun(agent.paneId, HANDOFF_PROMPT);

		await waitFor(
			() => livePane(agent.paneId).status === "working" || lastSeq(tail.events()) > baseline,
			HANDOFF_ACK_TIMEOUT_MS,
			"O agent não recebeu o pedido de resumo",
		);
		// `blocked` também é "terminou a vez" (o radar normaliza `done` assim), então a pergunta de
		// verdade é reconhecida pelo transcript: bloco `question` depois do pedido e sem resposta.
		await waitFor(
			() => {
				const status = livePane(agent.paneId).status;
				if (status === "working") {
					return false;
				}
				if (handoffQuestion(tail.events(), baseline)) {
					throw new Error("O agent fez uma pergunta em vez de resumir; responda no terminal");
				}

				return handoffSummary(tail.events(), baseline) !== null;
			},
			HANDOFF_TIMEOUT_MS,
			"O agent demorou demais para resumir a conversa",
		).catch((error: unknown) => {
			if (handoffSummary(tail.events(), baseline) === null) {
				throw error;
			}
		});

		const summary = handoffSummary(tail.events(), baseline);
		if (!summary) {
			throw new Error("O resumo não apareceu no transcript");
		}

		return summary;
	} finally {
		tail.close();
	}
}

async function runHandoff(agent: RadarAgent, input: ModelSwitchInput, job: HandoffJob) {
	const summary = await compactPane(agent);
	job.phase = "starting";

	const project = await projectFor(agent);
	const result = await Terminal.startSession({
		...project,
		cwd: agent.cwd,
		cli: input.cli,
		tab: continuationTab(agent),
		...(input.model ? { model: input.model } : {}),
		...(input.effort ? { effort: input.effort } : {}),
		permissionMode: "bypass",
		approvalMode: "bypass",
	});
	await deliverPrompt(
		result.paneId,
		handoffOpeningPrompt({
			from: agentRadarAgentLabel(agent.agent),
			summary,
			text: input.text,
		}),
	);
	await kwTerminalPaneClose(agent.paneId);

	job.paneId = result.paneId;
	job.phase = "done";
}

function startHandoff(agent: RadarAgent, input: ModelSwitchInput) {
	const job: HandoffJob = { phase: "compacting", cli: input.cli, startedAt: Date.now() };
	handoffs.set(agent.paneId, job);

	void runHandoff(agent, input, job)
		.catch((error: unknown) => {
			job.phase = "failed";
			job.error = error instanceof Error ? error.message : "Falha ao migrar a conversa";
			console.error(`[Radar] Falha na migração do pane ${agent.paneId}:`, error);
		})
		.finally(() => {
			setTimeout(() => {
				if (handoffs.get(agent.paneId) === job) {
					handoffs.delete(agent.paneId);
				}
			}, HANDOFF_JOB_TTL_MS).unref();
		});
}

export function handoffStatus(paneId: string): HandoffJob | null {
	return handoffs.get(paneId) ?? null;
}

export function switchPaneModel(input: ModelSwitchInput): Promise<ModelSwitchResult> {
	const agent = getRadarAgent(input.paneId);
	if (!agent) {
		throw new ORPCError("NOT_FOUND", { message: "Este agent não está mais aberto no terminal" });
	}

	const running = handoffs.get(input.paneId);
	if (running && (running.phase === "compacting" || running.phase === "starting")) {
		throw new ORPCError("CONFLICT", { message: "Esta conversa já está sendo migrada" });
	}
	if (agent.status === "working") {
		throw new ORPCError("CONFLICT", {
			message: "Aguarde o agent terminar o turno para trocar de modelo",
		});
	}

	if (agentRadarCli(agent.agent) === input.cli) {
		return reopen(agent, input);
	}

	startHandoff(agent, input);

	return Promise.resolve({ kind: "handoff" });
}
