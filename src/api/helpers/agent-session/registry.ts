import { ORPCError } from "@orpc/server";

import type { InvokeCli } from "@/constants/invoke";
import {
	type AgentEventPayload,
	type AgentEventPayloadOf,
	type AgentSessionEvent,
	type AgentSessionPatch,
	parseAgentEventPayload,
} from "@/lib/agent-session";
import { trim } from "@/lib/agent-stream";
import { createClaudeSessionParser } from "@/lib/claude-session-stream";
import { buildCodexExecArgs } from "@/lib/codex-command";
import { createCodexSessionParser } from "@/lib/codex-session-stream";
import { DEFAULT_KOWORK_PORT } from "@/lib/runtime-config";
import { envVariables } from "../../config/env";
import { dbAgentEvents } from "../../db/agent-events";
import { dbAgentSessions } from "../../db/agent-sessions";
import type { agent_sessions } from "../../db/connection";
import { dbExecutionRuns } from "../../db/execution-runs";
import { PubSub } from "../../pubsub";
import { PushNotifications } from "../push-notifications";
import { spawnEnv } from "../spawn";

const HEARTBEAT_INTERVAL_MS = 30_000;
export const SESSION_STALE_MS = 3 * HEARTBEAT_INTERVAL_MS;
const HANDSHAKE_TIMEOUT_MS = 15_000;
const TURN_TIMEOUT_MS = 45 * 60_000;
const QUESTION_TIMEOUT_MS = 30 * 60_000;
const DETAIL_MAX_CHARS = 400;

// A sessão roda sem TTY: qualquer subprocesso que o agente dispare (git, editor, pager) precisa
// falhar rápido em vez de bloquear esperando entrada que nunca vem.
const HEADLESS_ENV: Record<string, string> = {
	GIT_TERMINAL_PROMPT: "0",
	GIT_EDITOR: "true",
	GIT_PAGER: "cat",
	EDITOR: "true",
	VISUAL: "true",
	PAGER: "cat",
	DEBIAN_FRONTEND: "noninteractive",
};

const ASK_USER_TOOL = "mcp__koworker__ask_user";

const ASK_USER_INSTRUCTION = [
	"Quando precisar de uma decisão do usuário para seguir, chame a ferramenta",
	`\`${ASK_USER_TOOL}\` com 2 a 4 opções em vez de encerrar o turno perguntando em texto.`,
	"A resposta chega pela interface do Kowork.",
].join(" ");

type PendingQuestion = {
	resolve: (value: { answers: string[]; freeText?: string }) => void;
	id: string;
	seq: number;
};

type SessionParser = {
	push: (chunk: string) => AgentSessionPatch[];
	flush: () => AgentSessionPatch[];
};

// Os dois CLIs vivem na mesma linha do banco e na mesma conversa, mas não no mesmo processo: no
// `claude` o `proc` é a sessão inteira, viva entre turnos; no `codex` ele é só o turno da vez, e
// entre turnos a sessão é a linha do banco mais o `cliSessionId` que o `resume` exige.
type LiveSession = {
	id: string;
	userId: number;
	cli: InvokeCli;
	record: agent_sessions;
	proc: ReturnType<typeof Bun.spawn> | null;
	cliSessionId?: string;
	seq: number;
	busy: boolean;
	currentRunId?: string;
	turnStartedAt?: number;
	toolEvents: Map<string, { id: string; seq: number; payload: AgentEventPayloadOf<"tool_use"> }>;
	permissions: Map<
		string,
		{ id: string; seq: number; payload: AgentEventPayloadOf<"permission">; input: unknown }
	>;
	questions: Map<string, PendingQuestion>;
	handshake?: { resolve: () => void; reject: (error: Error) => void; done: boolean };
	interrupting: boolean;
	closing: boolean;
};

const sessions = new Map<string, LiveSession>();
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function startHeartbeat() {
	if (heartbeatTimer) {
		return;
	}

	heartbeatTimer = setInterval(() => {
		const ids = [...sessions.keys()];
		if (ids.length === 0 && heartbeatTimer) {
			clearInterval(heartbeatTimer);
			heartbeatTimer = null;
			return;
		}

		void dbAgentSessions.touchHeartbeat(ids).catch((error) => {
			console.error("[Sessões] Falha ao registrar o sinal de vida:", error);
		});
	}, HEARTBEAT_INTERVAL_MS);
	heartbeatTimer.unref();
}

function write(session: LiveSession, message: unknown) {
	const stdin = session.proc?.stdin;
	if (!stdin || typeof stdin === "number") {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "A sessão perdeu o canal de entrada do agente",
		});
	}

	stdin.write(`${JSON.stringify(message)}\n`);
	stdin.flush();
}

async function publishEvents(sessionId: string, events: AgentSessionEvent[]) {
	await PubSub.publish("agentSession", sessionId, { sessionId, events });
}

async function emit(
	session: LiveSession,
	payload: AgentEventPayload,
): Promise<{ id: string; seq: number }> {
	const id = crypto.randomUUID();
	const seq = session.seq;
	session.seq += 1;
	const at = Date.now();

	await dbAgentEvents.create({
		id,
		session_id: session.id,
		seq,
		kind: payload.kind,
		payload: JSON.stringify(payload),
		created_at: at,
		...(session.currentRunId ? { run_id: session.currentRunId } : {}),
	});

	await publishEvents(session.id, [
		{
			id,
			sessionId: session.id,
			seq,
			at,
			payload,
			...(session.currentRunId ? { runId: session.currentRunId } : {}),
		},
	]);

	return { id, seq };
}

async function patchEvent(
	session: LiveSession,
	target: { id: string; seq: number },
	payload: AgentEventPayload,
) {
	await dbAgentEvents.updatePayload(target.id, JSON.stringify(payload));
	await publishEvents(session.id, [
		{ id: target.id, sessionId: session.id, seq: target.seq, at: Date.now(), payload },
	]);
}

async function setBusy(session: LiveSession, busy: boolean) {
	session.busy = busy;
	await PubSub.publish("agentSession", session.id, { sessionId: session.id, busy });
}

function notifySession(
	session: LiveSession,
	input: { title: string; body: string; blocking?: boolean },
) {
	void PushNotifications.send(session.userId, {
		title: input.title,
		body: input.body,
		url: `/executar/${session.id}`,
		// Uma tag por sessão evita empilhar avisos da mesma conversa, mas o pedido que segura o agente
		// não pode ser engolido pelo aviso seguinte: ele tem tag própria e fica até o toque.
		tag: input.blocking ? `session-${session.id}-pending` : `session-${session.id}`,
		...(input.blocking ? { requireInteraction: true } : {}),
	}).catch(() => {});
}

async function finishTurn(
	session: LiveSession,
	outcome: {
		status: "done" | "failed" | "cancelled" | "timeout";
		error?: string;
		costUsd?: number;
	},
) {
	const runId = session.currentRunId;
	session.currentRunId = undefined;
	session.turnStartedAt = undefined;
	session.interrupting = false;
	await setBusy(session, false);

	if (!runId) {
		return;
	}

	await dbExecutionRuns.finishIfRunning(runId, {
		status: outcome.status,
		...(outcome.error ? { error: outcome.error } : {}),
	});
}

async function applyPatch(session: LiveSession, patch: AgentSessionPatch) {
	if (patch.type === "append") {
		const stored = await emit(session, patch.payload);
		if (patch.payload.kind === "tool_use" && patch.payload.toolUseId) {
			session.toolEvents.set(patch.payload.toolUseId, { ...stored, payload: patch.payload });
		}

		return;
	}

	if (patch.type === "settle") {
		const target = session.toolEvents.get(patch.toolUseId);
		if (!target) {
			return;
		}
		session.toolEvents.delete(patch.toolUseId);
		await patchEvent(session, target, {
			...target.payload,
			status: patch.ok ? "ok" : "error",
			...(patch.detail ? { detail: patch.detail } : {}),
		});

		return;
	}

	// Só o codex batiza a conversa: guardar o id da thread assim que ele aparece é o que permite
	// `resume` daqui em diante, inclusive depois de o servidor reiniciar.
	if (patch.type === "cliSession") {
		if (session.cliSessionId === patch.cliSessionId) {
			return;
		}
		session.cliSessionId = patch.cliSessionId;
		session.record = await dbAgentSessions.update(session.id, {
			cli_session_id: patch.cliSessionId,
		});

		return;
	}

	if (patch.type === "permission") {
		const payload: AgentEventPayloadOf<"permission"> = {
			kind: "permission",
			requestId: patch.requestId,
			toolName: patch.toolName,
			label: patch.label,
			...(patch.detail ? { detail: patch.detail } : {}),
		};
		const stored = await emit(session, payload);
		session.permissions.set(patch.requestId, { ...stored, payload, input: patch.input });
		notifySession(session, {
			title: "O agente pede permissão",
			body: `Permitir ${patch.label}?`,
			blocking: true,
		});

		return;
	}

	await emit(session, {
		kind: "result",
		status: patch.status,
		...(patch.durationMs ? { durationMs: patch.durationMs } : {}),
		...(patch.costUsd ? { costUsd: patch.costUsd } : {}),
		...(patch.error ? { error: patch.error } : {}),
	});
	await finishTurn(session, {
		status: patch.status,
		...(patch.error ? { error: patch.error } : {}),
	});
	notifySession(session, {
		title: patch.status === "done" ? "Turno concluído" : "Turno falhou",
		body:
			patch.status === "done"
				? "O agente terminou e espera sua próxima instrução."
				: "Abra a sessão para ver o que aconteceu.",
	});
}

function handleControlResponse(session: LiveSession, line: { response?: { subtype?: string } }) {
	const handshake = session.handshake;
	if (!handshake || handshake.done) {
		return;
	}

	handshake.done = true;
	if (line.response?.subtype === "success") {
		handshake.resolve();
		return;
	}

	handshake.reject(new Error("O agente recusou o handshake da sessão"));
}

async function consume(
	session: LiveSession,
	stdout: ReadableStream<Uint8Array> | number | undefined,
	parser: SessionParser,
) {
	if (!stdout || typeof stdout === "number") {
		return;
	}

	const reader = stdout.getReader();
	const decoder = new TextDecoder();

	async function apply(patches: AgentSessionPatch[]) {
		for (const patch of patches) {
			await applyPatch(session, patch).catch((error) => {
				console.error("[Sessões] Falha ao gravar bloco da conversa:", error);
			});
		}
	}

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		if (!value) {
			continue;
		}
		const text = decoder.decode(value, { stream: true });

		// O handshake responde num `control_response` que não vira bloco da conversa: ele é lido aqui,
		// antes da tradução, porque só ele confirma que a sessão está de pé.
		for (const raw of text.split("\n")) {
			if (!raw.includes('"control_response"')) {
				continue;
			}
			try {
				handleControlResponse(session, JSON.parse(raw));
			} catch {}
		}

		await apply(parser.push(text));
	}

	await apply(parser.flush());
}

async function teardown(session: LiveSession, reason: string, status: "ended" | "crashed") {
	sessions.delete(session.id);

	for (const pending of session.questions.values()) {
		pending.resolve({ answers: [], freeText: "A sessão foi encerrada antes da resposta." });
	}
	session.questions.clear();

	await finishTurn(session, {
		status: status === "ended" ? "cancelled" : "failed",
		error: reason,
	});

	const changed = await dbAgentSessions.endIfLive(session.id, { status, reason });
	if (changed) {
		await PubSub.publish("agentSession", session.id, {
			sessionId: session.id,
			status,
			endReason: reason,
			busy: false,
		});
	}
}

function mcpUrl(sessionId: string) {
	const port = Number(envVariables.KOWORK_PORT) || DEFAULT_KOWORK_PORT;

	return `http://127.0.0.1:${port}/mcp/session/${sessionId}`;
}

function buildArgv(session: agent_sessions, resume: boolean) {
	const argv = [
		"claude",
		"-p",
		"--input-format",
		"stream-json",
		"--output-format",
		"stream-json",
		"--verbose",
		"--permission-prompt-tool",
		"stdio",
		"--permission-mode",
		session.permission_mode,
		"--mcp-config",
		JSON.stringify({ mcpServers: { koworker: { type: "http", url: mcpUrl(session.id) } } }),
		// Pedir permissão para perguntar ao usuário é uma pergunta a mais na frente da pergunta.
		"--allowedTools",
		ASK_USER_TOOL,
		"--append-system-prompt",
		ASK_USER_INSTRUCTION,
		resume ? "--resume" : "--session-id",
		session.id,
	];

	if (session.agent) {
		argv.push("--agent", session.agent);
	}
	if (session.model) {
		argv.push("--model", session.model);
	}
	if (session.effort) {
		argv.push("--effort", session.effort);
	}

	return argv;
}

async function registerSession(record: agent_sessions) {
	const session: LiveSession = {
		id: record.id,
		userId: record.user_id,
		cli: record.cli === "codex" ? "codex" : "claude",
		record,
		proc: null,
		seq: await dbAgentEvents.nextSeq(record.id),
		busy: false,
		toolEvents: new Map(),
		permissions: new Map(),
		questions: new Map(),
		interrupting: false,
		closing: false,
		...(record.cli_session_id ? { cliSessionId: record.cli_session_id } : {}),
	};

	sessions.set(record.id, session);
	startHeartbeat();

	return session;
}

// Sobe o processo e faz o handshake que mantém a sessão viva entre turnos: sem o `initialize` o CLI
// encerra assim que o primeiro turno termina, que é o comportamento de chamada única.
async function spawnClaudeSession(record: agent_sessions, resume: boolean) {
	const env = spawnEnv(HEADLESS_ENV);
	const argv = buildArgv(record, resume);

	if (!Bun.which("claude", { PATH: env.PATH })) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message:
				'O comando "claude" não foi encontrado no PATH do servidor — verifique a instalação do CLI.',
		});
	}

	const proc = Bun.spawn(argv, {
		cwd: record.cwd,
		stdin: "pipe",
		stdout: "pipe",
		stderr: "pipe",
		env,
	});

	let resolveHandshake = () => {};
	let rejectHandshake = (_error: Error) => {};
	const handshakeDone = new Promise<void>((resolve, reject) => {
		resolveHandshake = resolve;
		rejectHandshake = reject;
	});

	const session = await registerSession(record);
	session.proc = proc;
	session.handshake = { resolve: resolveHandshake, reject: rejectHandshake, done: false };

	void consume(session, proc.stdout, createClaudeSessionParser()).catch((error) => {
		console.error("[Sessões] Leitura do agente interrompida:", error);
	});

	void proc.exited.then((code) => {
		const reason = session.closing
			? "A sessão foi encerrada."
			: `O agente encerrou o processo (código ${code}).`;

		return teardown(session, reason, session.closing ? "ended" : "crashed").catch((error) => {
			console.error("[Sessões] Falha ao encerrar a sessão:", error);
		});
	});

	write(session, {
		type: "control_request",
		request_id: `init-${record.id}`,
		request: { subtype: "initialize", hooks: {} },
	});

	await Promise.race([
		handshakeDone,
		Bun.sleep(HANDSHAKE_TIMEOUT_MS).then(() => {
			if (!session.handshake?.done) {
				throw new Error("O agente não respondeu ao handshake da sessão");
			}
		}),
	]).catch(async (error) => {
		session.closing = true;
		proc.kill();
		await teardown(session, error.message, "crashed");
		throw new ORPCError("INTERNAL_SERVER_ERROR", { message: error.message });
	});

	await dbAgentSessions.update(record.id, {
		status: "live",
		pid: proc.pid,
		heartbeat_at: Date.now(),
		end_reason: null,
	});

	return session;
}

// O turno do codex é um processo inteiro: ele nasce com o prompt, anuncia a thread, transmite os
// itens e morre. Entre um turno e outro só resta a linha do banco, e é o `--resume <thread>` que
// devolve o contexto — por isso o id da thread é gravado assim que aparece.
async function runCodexTurn(session: LiveSession, prompt: string) {
	const env = spawnEnv(HEADLESS_ENV);

	if (!Bun.which("codex", { PATH: env.PATH })) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message:
				'O comando "codex" não foi encontrado no PATH do servidor — verifique a instalação do CLI.',
		});
	}

	const proc = Bun.spawn(
		buildCodexExecArgs({
			prompt,
			approvalMode: session.record.permission_mode,
			structuredOutput: true,
			persistSession: true,
			mcpUrl: mcpUrl(session.id),
			cwd: session.record.cwd,
			...(session.cliSessionId ? { resumeSessionId: session.cliSessionId } : {}),
			...(session.record.model ? { model: session.record.model } : {}),
			...(session.record.effort ? { effort: session.record.effort } : {}),
		}),
		{ cwd: session.record.cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe", env },
	);

	session.proc = proc;
	await dbAgentSessions.update(session.id, { pid: proc.pid, heartbeat_at: Date.now() });

	const stderr = new Response(proc.stderr as ReadableStream<Uint8Array>).text();
	await consume(session, proc.stdout, createCodexSessionParser());
	const code = await proc.exited;
	session.proc = null;

	// Sem `turn.completed` o turno não se fechou sozinho: o processo caiu ou foi interrompido. O
	// desfecho é gravado aqui para a conversa não ficar presa em "trabalhando".
	if (!session.currentRunId) {
		return;
	}

	if (session.interrupting) {
		await emit(session, { kind: "result", status: "cancelled" });
		await finishTurn(session, { status: "cancelled" });

		return;
	}

	const error =
		trim(await stderr, DETAIL_MAX_CHARS) ?? `O codex encerrou o turno (código ${code}).`;
	await emit(session, { kind: "result", status: "failed", error });
	await finishTurn(session, { status: "failed", error });
}

export function getLiveSession(sessionId: string) {
	return sessions.get(sessionId);
}

export function liveSessionIds() {
	return [...sessions.keys()];
}

export async function startSession(params: {
	userId: number;
	projectId: string;
	taskId?: string;
	title: string;
	cli: InvokeCli;
	cwd: string;
	model?: string;
	effort?: string;
	agent?: string;
	permissionMode: string;
}) {
	if (params.taskId) {
		const running = await dbAgentSessions.getLiveForTask(params.taskId);
		if (running) {
			throw new ORPCError("CONFLICT", {
				message: "Esta tarefa já tem uma sessão em andamento. Abra a sessão ou encerre antes.",
			});
		}
	}

	const now = Date.now();
	const record = await dbAgentSessions.create({
		id: crypto.randomUUID(),
		user_id: params.userId,
		project_id: params.projectId,
		title: params.title,
		cli: params.cli,
		cwd: params.cwd,
		status: "live",
		permission_mode: params.permissionMode,
		started_at: now,
		updated_at: now,
		heartbeat_at: now,
		...(params.taskId ? { task_id: params.taskId } : {}),
		...(params.model ? { model: params.model } : {}),
		...(params.effort ? { effort: params.effort } : {}),
		...(params.agent ? { agent: params.agent } : {}),
	});

	// O codex não tem processo entre turnos: a sessão nasce viva na memória e só ganha processo
	// quando o primeiro turno é despachado.
	if (params.cli === "codex") {
		await registerSession(record);

		return record;
	}

	await spawnClaudeSession(record, false).catch(async (error) => {
		await dbAgentSessions.endIfLive(record.id, {
			status: "crashed",
			reason: error instanceof Error ? error.message : "A sessão não pôde ser iniciada",
		});
		throw error;
	});

	return record;
}

export async function resumeSession(record: agent_sessions) {
	if (sessions.has(record.id)) {
		return record;
	}

	await dbAgentSessions.update(record.id, { status: "live", heartbeat_at: Date.now() });

	if (record.cli === "codex") {
		await registerSession(record);
	} else {
		await spawnClaudeSession(record, true).catch(async (error) => {
			await dbAgentSessions.endIfLive(record.id, {
				status: "crashed",
				reason: error instanceof Error ? error.message : "A sessão não pôde ser retomada",
			});
			throw error;
		});
	}

	await PubSub.publish("agentSession", record.id, {
		sessionId: record.id,
		status: "live",
		busy: false,
	});

	return record;
}

export async function sendTurn(params: {
	session: agent_sessions;
	prompt: string;
	originalPrompt?: string;
	inputKind: string;
}) {
	const live = sessions.get(params.session.id);
	if (!live) {
		throw new ORPCError("CONFLICT", {
			message: "Esta sessão não está mais no ar. Retome antes de continuar.",
		});
	}
	if (live.busy) {
		throw new ORPCError("CONFLICT", {
			message: "O agente ainda está trabalhando neste turno. Aguarde ou interrompa.",
		});
	}

	const now = Date.now();
	const run = await dbExecutionRuns.create({
		id: crypto.randomUUID(),
		user_id: params.session.user_id,
		project_id: params.session.project_id,
		session_id: params.session.id,
		cli_session_id: live.cliSessionId ?? params.session.id,
		kind: "prompt",
		title: params.session.title,
		status: "running",
		prompt: params.prompt,
		original_prompt: params.originalPrompt ?? params.prompt,
		source: "execution_route",
		interaction_mode: "interactive",
		input_kind: params.inputKind,
		cli: live.cli,
		permission_mode: params.session.permission_mode,
		started_at: now,
		updated_at: now,
		heartbeat_at: now,
		...(params.session.task_id ? { task_id: params.session.task_id } : {}),
		...(params.session.model ? { model: params.session.model } : {}),
		...(params.session.effort ? { effort: params.session.effort } : {}),
		...(params.session.agent ? { agent: params.session.agent } : {}),
	});

	live.currentRunId = run.id;
	live.turnStartedAt = now;
	await emit(live, { kind: "user", text: params.prompt });
	await setBusy(live, true);

	// O turno do codex é longo e tem processo próprio: ele corre solto e o desfecho chega pelos
	// blocos, como no claude. Esperar aqui prenderia a resposta do despacho até o fim do trabalho.
	if (live.cli === "codex") {
		void runCodexTurn(live, params.prompt).catch(async (error) => {
			const message = error instanceof Error ? error.message : "O turno não pôde ser despachado";
			await emit(live, { kind: "result", status: "failed", error: message });
			await finishTurn(live, { status: "failed", error: message });
		});

		return { runId: run.id };
	}

	write(live, { type: "user", message: { role: "user", content: params.prompt } });

	return { runId: run.id };
}

export async function respondPermission(params: {
	sessionId: string;
	requestId: string;
	decision: "allow" | "deny";
	reason?: string;
}) {
	const live = sessions.get(params.sessionId);
	if (!live) {
		throw new ORPCError("CONFLICT", { message: "Esta sessão não está mais no ar." });
	}

	const pending = live.permissions.get(params.requestId);
	if (!pending) {
		throw new ORPCError("NOT_FOUND", { message: "Este pedido de permissão não está mais aberto" });
	}

	live.permissions.delete(params.requestId);

	write(live, {
		type: "control_response",
		response: {
			subtype: "success",
			request_id: params.requestId,
			response:
				params.decision === "allow"
					? { behavior: "allow", updatedInput: pending.input }
					: {
							behavior: "deny",
							message: params.reason ?? "O usuário negou esta ação pela interface do Kowork.",
						},
		},
	});

	await patchEvent(live, pending, {
		...pending.payload,
		decision: params.decision,
		...(params.reason ? { reason: params.reason } : {}),
	});
}

// A pergunta chega pela ferramenta MCP: o handler HTTP fica pendurado neste promise até a resposta
// vir da rota, e é isso que segura o agente esperando em vez de ele seguir adivinhando.
export async function askUser(params: {
	sessionId: string;
	question: string;
	options: { label: string; description?: string }[];
	multiSelect: boolean;
}) {
	const live = sessions.get(params.sessionId);
	if (!live) {
		throw new Error("A sessão não está mais no ar");
	}

	const questionId = crypto.randomUUID();
	const payload: AgentEventPayloadOf<"question"> = {
		kind: "question",
		questionId,
		question: params.question,
		options: params.options,
		multiSelect: params.multiSelect,
	};
	const stored = await emit(live, payload);

	notifySession(live, {
		title: "O agente tem uma pergunta",
		body: params.question,
		blocking: true,
	});

	const answer = await new Promise<{ answers: string[]; freeText?: string }>((resolve) => {
		live.questions.set(questionId, { resolve, ...stored });
		setTimeout(() => {
			if (live.questions.delete(questionId)) {
				resolve({ answers: [], freeText: "Ninguém respondeu a tempo." });
			}
		}, QUESTION_TIMEOUT_MS).unref();
	});

	await patchEvent(live, stored, {
		...payload,
		answers: answer.answers,
		...(answer.freeText ? { freeText: answer.freeText } : {}),
	});

	return answer;
}

export function answerQuestion(params: {
	sessionId: string;
	questionId: string;
	answers: string[];
	freeText?: string;
}) {
	const live = sessions.get(params.sessionId);
	const pending = live?.questions.get(params.questionId);
	if (!live || !pending) {
		throw new ORPCError("NOT_FOUND", { message: "Esta pergunta não está mais aberta" });
	}

	live.questions.delete(params.questionId);
	pending.resolve({
		answers: params.answers,
		...(params.freeText ? { freeText: params.freeText } : {}),
	});
}

export async function interruptSession(sessionId: string) {
	const live = sessions.get(sessionId);
	if (!live) {
		throw new ORPCError("CONFLICT", { message: "Esta sessão não está mais no ar." });
	}

	live.interrupting = true;

	// No codex o turno é o processo: interromper é matá-lo, e a sessão continua retomável.
	if (live.cli === "codex") {
		live.proc?.kill();
		await emit(live, { kind: "notice", label: "Interrupção pedida", tone: "info" });

		return;
	}

	write(live, {
		type: "control_request",
		request_id: `interrupt-${crypto.randomUUID()}`,
		request: { subtype: "interrupt" },
	});

	await emit(live, { kind: "notice", label: "Interrupção pedida", tone: "info" });
}

export async function endSession(sessionId: string, reason: string) {
	const live = sessions.get(sessionId);
	if (!live) {
		await dbAgentSessions.endIfLive(sessionId, { status: "ended", reason });
		await PubSub.publish("agentSession", sessionId, {
			sessionId,
			status: "ended",
			endReason: reason,
			busy: false,
		});

		return;
	}

	live.closing = true;
	live.proc?.kill();

	// O `claude` encerra pela saída do processo, que dispara o teardown; o `codex` pode nem ter
	// processo no ar, então o encerramento é gravado aqui.
	if (live.cli === "codex") {
		await teardown(live, reason, "ended");

		return;
	}

	await live.proc?.exited;
}

export async function setPermissionMode(sessionId: string, mode: string) {
	const live = sessions.get(sessionId);
	if (!live) {
		throw new ORPCError("CONFLICT", { message: "Esta sessão não está mais no ar." });
	}

	// O codex fixa a política no spawn do turno: trocar aqui vale do próximo turno em diante.
	if (live.cli === "claude") {
		write(live, {
			type: "control_request",
			request_id: `mode-${crypto.randomUUID()}`,
			request: { subtype: "set_permission_mode", mode },
		});
	}

	live.record = await dbAgentSessions.update(sessionId, { permission_mode: mode });
	await emit(live, { kind: "notice", label: `Modo de permissão: ${mode}`, tone: "info" });
}

export async function listSessionEvents(sessionId: string): Promise<AgentSessionEvent[]> {
	const rows = await dbAgentEvents.listForSession(sessionId);

	return rows.map((row) => {
		const event: AgentSessionEvent = {
			id: row.id,
			sessionId: row.session_id,
			seq: row.seq,
			at: row.created_at,
			payload: parseAgentEventPayload(row.payload),
		};
		if (row.run_id) {
			event.runId = row.run_id;
		}

		return event;
	});
}

export function isSessionBusy(sessionId: string) {
	return sessions.get(sessionId)?.busy ?? false;
}

// O turno tem teto próprio: o agente parado esperando o usuário não é um agente travado, mas o que
// passa do teto trabalhando está. A sessão ociosa continua viva de propósito.
export async function reconcileSessions() {
	const stale = await dbAgentSessions.listStale(Date.now() - SESSION_STALE_MS);

	for (const record of stale) {
		if (sessions.has(record.id)) {
			continue;
		}

		await dbAgentSessions.endIfLive(record.id, {
			status: "crashed",
			reason: "O executor que iniciou esta sessão não está mais no ar.",
		});
		await PubSub.publish("agentSession", record.id, {
			sessionId: record.id,
			status: "crashed",
			endReason: "O executor que iniciou esta sessão não está mais no ar.",
			busy: false,
		});
	}

	const now = Date.now();
	for (const live of sessions.values()) {
		if (live.turnStartedAt && now - live.turnStartedAt > TURN_TIMEOUT_MS) {
			await interruptSession(live.id).catch(() => {});
			await finishTurn(live, {
				status: "timeout",
				error: "O turno excedeu o tempo limite de 45 minutos.",
			});
		}
	}

	return stale.length;
}

export function startSessionReconciler() {
	const timer = setInterval(() => {
		void reconcileSessions().catch((error) => {
			console.error("[Sessões] Falha ao reconciliar:", error);
		});
	}, HEARTBEAT_INTERVAL_MS * 2);
	timer.unref();

	return reconcileSessions();
}

export async function shutdownSessions() {
	const total = sessions.size;

	for (const live of sessions.values()) {
		live.closing = true;
		live.proc?.kill();
		// A sessão do codex não morre pela saída de um processo: sem isso ela ficaria `live` no banco
		// depois do desligamento, e a reconciliação só a marcaria como caída minutos depois.
		if (live.cli === "codex") {
			void teardown(live, "O servidor foi encerrado.", "ended").catch(() => {});
		}
	}

	const deadline = Date.now() + 5_000;
	while (sessions.size > 0 && Date.now() < deadline) {
		await Bun.sleep(50);
	}

	return total;
}
