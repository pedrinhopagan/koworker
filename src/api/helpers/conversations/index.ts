import { ORPCError } from "@orpc/server";
import { stat } from "node:fs/promises";
import { setTimeout as waitForChange } from "node:timers/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { getRadarAgent } from "@/api/helpers/agent-radar/state";
import { locateAgentTranscript } from "@/api/helpers/agent-radar/transcript/locate";
import { syncPaneTranscriptSource } from "@/api/helpers/agent-radar/transcript/sync";
import { z } from "zod";
import { dbProjects } from "@/api/db/projects";
import { DbConversations, type ConversationDetail } from "@/api/db/conversations";
import { PubSub } from "@/api/pubsub";
import type {
	ConversationCreateInput,
	ConversationRespondInput,
	ConversationSendInput,
	ConversationHistoryInput,
	ConversationImportInput,
} from "@/api/schemas/conversations";
import { CONVERSATION_PERMISSIONS } from "@/constants/conversation";
import {
	CodexThreadResponseSchema,
	CodexModelListSchema,
	CodexThreadSchema,
	CodexTurnSchema,
	CodexHistoryListSchema,
	CodexHistoryReadSchema,
	type ConversationProjection,
	type ConversationProfileSchema,
	emptyConversationProjection,
} from "@/lib/conversation";
import { CodexAppServer, type CodexEnvelope } from "@/api/helpers/conversations/app-server";
import { applyCodexEvent, permissionResponse } from "@/api/helpers/conversations/projection";
import { listRadarAgents, matchProjectByCwd } from "@/api/helpers/agent-radar/state";

type ProfileId = z.infer<typeof ConversationProfileSchema>;
type LoadedConversation = {
	userId: number;
	profileId: ProfileId;
	threadId: string;
	projection: ConversationProjection;
	timer?: ReturnType<typeof setTimeout>;
};

function liveCodexPane(threadId: string) {
	return (
		listRadarAgents().find((agent) => agent.agent === "codex" && agent.sessionId === threadId)
			?.paneId ?? null
	);
}

class ConversationsRuntime {
	private readonly readers = new Map<string, CodexAppServer>();
	private readonly paneReads = new Map<
		string,
		{
			fingerprint: string;
			value: Promise<{
				threadId: string;
				cwd: string;
				model: string | null;
				effort: string | null;
				projection: ConversationProjection;
			}>;
		}
	>();
	private readonly servers = new Map<ProfileId, CodexAppServer>();
	private readonly loaded = new Map<string, LoadedConversation>();
	private readonly operations = new Map<string, Promise<unknown>>();
	private events: Promise<unknown> = Promise.resolve();
	private readonly rawRequests = new Map<string, unknown>();

	private async server(profileId: ProfileId) {
		const current = this.servers.get(profileId);
		if (current) {
			await current.ready;
			return current;
		}
		const server = new CodexAppServer(
			profileId,
			(event) => {
				this.events = this.events
					.catch(() => {})
					.then(() => this.onEvent(profileId, server, event));
				return this.events.then(() => {});
			},
			async () => {
				if (this.servers.get(profileId) !== server) {
					return;
				}
				this.servers.delete(profileId);
				await this.events.catch(() => {});
				for (const [id, loaded] of this.loaded) {
					if (loaded.profileId !== profileId) {
						continue;
					}
					loaded.projection.requests = [];
					if (loaded.projection.activeTurnId) {
						loaded.projection.error =
							"O Codex foi encerrado durante a execução. Reabra a conversa para conferir o histórico.";
					}
					loaded.projection.activeTurnId = null;
					await this.persist(id, loaded);
					this.loaded.delete(id);
				}
				for (const key of this.rawRequests.keys()) {
					if (key.startsWith(`${server.runtimeId}:`)) {
						this.rawRequests.delete(key);
					}
				}
			},
		);
		this.servers.set(profileId, server);
		await server.ready;
		return server;
	}

	private async serial<T>(id: string, operation: () => Promise<T>): Promise<T> {
		const next = (this.operations.get(id) ?? Promise.resolve()).catch(() => {}).then(operation);
		this.operations.set(id, next);
		try {
			return await next;
		} finally {
			if (this.operations.get(id) === next) {
				this.operations.delete(id);
			}
		}
	}

	private async persist(id: string, loaded: LoadedConversation) {
		if (loaded.timer) {
			clearTimeout(loaded.timer);
			delete loaded.timer;
		}
		await DbConversations.saveProjection(id, structuredClone(loaded.projection));
		await this.publish(id, loaded.userId);
	}

	private async publish(id: string, userId: number) {
		const detail = await DbConversations.get(id, userId);
		await PubSub.publish("conversation", id, detail);
		await PubSub.publish("conversations", String(userId), { id });
		return detail;
	}

	private snapshot(loaded: LoadedConversation, thread: unknown) {
		this.events = this.events
			.catch(() => {})
			.then(() => {
				const parsed = CodexThreadSchema.parse(thread);
				loaded.projection.turns = parsed.turns;
				loaded.projection.activeTurnId =
					parsed.turns.findLast((turn) => turn.status === "inProgress")?.id ?? null;
			});
		return this.events.then(() => {});
	}

	private async onEvent(profileId: ProfileId, server: CodexAppServer, event: CodexEnvelope) {
		const threadId = z
			.object({ threadId: z.string().optional() })
			.parse(event.params ?? {}).threadId;
		const entry = [...this.loaded].find(
			([, loaded]) => loaded.profileId === profileId && loaded.threadId === threadId,
		);
		if (!entry) {
			if (event.id !== undefined) {
				await server.rejectRequest(event.id);
			}
			return;
		}
		const [id, loaded] = entry;
		let applied;
		try {
			applied = applyCodexEvent(loaded.projection, event, server.runtimeId);
		} catch (error) {
			if (event.id === undefined) {
				throw error;
			}
			await server.rejectRequest(event.id);
			loaded.projection.error = "O Codex enviou um pedido incompatível com esta versão do Kowork.";
			await this.persist(id, loaded);
			return;
		}
		if (!applied) {
			if (event.id === undefined) {
				return;
			}
			await server.rejectRequest(event.id);
			loaded.projection.error = "O Codex pediu uma interação ainda não suportada nesta conversa.";
		}
		if (applied && event.id !== undefined) {
			this.rawRequests.set(`${server.runtimeId}:${event.id}`, event.params);
		}
		if (event.method === "serverRequest/resolved") {
			const { requestId } = z
				.object({ requestId: z.union([z.string(), z.number()]) })
				.parse(event.params);
			this.rawRequests.delete(`${server.runtimeId}:${requestId}`);
		}
		if (event.method === "turn/completed" || event.id !== undefined) {
			await this.persist(id, loaded);
			return;
		}
		loaded.timer ??= setTimeout(() => {
			this.events = this.events.catch(() => {}).then(() => this.persist(id, loaded));
			void this.events.catch((error) => console.error("Falha ao persistir conversa:", error));
		}, 100);
	}

	private async load(detail: ConversationDetail, server: CodexAppServer, userId: number) {
		if (detail.threadId && liveCodexPane(detail.threadId)) {
			throw new ORPCError("CONFLICT", {
				message:
					"Esta conversa está aberta na CLI. Acompanhe e responda pelo agent ativo na sidebar.",
			});
		}
		const current = this.loaded.get(detail.id);
		if (current) {
			return current;
		}
		if (!detail.threadId) {
			throw new ORPCError("CONFLICT", {
				message: "Esta conversa não chegou a ser criada no Codex. Inicie uma nova conversa.",
			});
		}
		const permission = CONVERSATION_PERMISSIONS.find(
			(entry) => entry.id === detail.permissionMode,
		)!;
		const loaded: LoadedConversation = {
			userId,
			profileId: detail.profileId,
			threadId: detail.threadId,
			projection: { ...detail.projection, requests: [], error: null },
		};
		this.loaded.set(detail.id, loaded);
		try {
			await server.call(
				"thread/resume",
				{
					threadId: detail.threadId,
					cwd: detail.cwd,
					approvalPolicy: permission.approvalPolicy,
					sandbox: permission.sandbox,
					approvalsReviewer: "user",
				},
				(result) => this.snapshot(loaded, CodexThreadResponseSchema.parse(result).thread),
			);
		} catch (error) {
			this.loaded.delete(detail.id);
			throw error;
		}
		for (const message of detail.messages) {
			if (message.status !== "sending" && message.status !== "uncertain") {
				continue;
			}
			const confirmed = loaded.projection.turns.some((turn) =>
				turn.items.some((item) => item.type === "userMessage" && item.clientId === message.id),
			);
			if (confirmed) {
				continue;
			}
			await DbConversations.setMessage(
				detail.id,
				message.id,
				loaded.projection.activeTurnId ? "uncertain" : "failed",
				{
					error: loaded.projection.activeTurnId
						? "A execução ainda está ativa. Confira o histórico para confirmar a entrega."
						: "A retomada não encontrou este envio no histórico. Você pode enviá-lo novamente.",
				},
			);
		}
		return loaded;
	}

	async readPane(paneId: string) {
		await syncPaneTranscriptSource(paneId);
		const agent = getRadarAgent(paneId);
		if (!agent || agent.agent !== "codex") {
			this.paneReads.delete(paneId);
			throw new ORPCError("NOT_FOUND", { message: "Este Codex não está mais aberto no terminal." });
		}
		const source = await locateAgentTranscript(agent);
		if (!source || source.cli !== "codex") {
			return {
				threadId: agent.sessionId,
				cwd: agent.cwd,
				model: null,
				effort: null,
				projection: emptyConversationProjection(),
			};
		}
		const sessionsIndex = source.path.lastIndexOf("/sessions/");
		if (sessionsIndex < 1) {
			throw new ORPCError("BAD_REQUEST", {
				message: "O diretório nativo desta conversa não foi reconhecido.",
			});
		}
		const home = source.path.slice(0, sessionsIndex);
		const file = await stat(source.path);
		const historyFiles = await Promise.all(
			["thread_history_1.sqlite", "thread_history_1.sqlite-wal"].map(async (name) => {
				const info = await stat(join(home, name)).catch(() => null);
				return `${info?.size ?? 0}:${info?.mtimeMs ?? 0}`;
			}),
		);
		const fingerprint = `${source.path}:${file.size}:${file.mtimeMs}:${agent.sessionId}:${agent.cwd}:${agent.status}:${historyFiles.join(":")}`;
		const previous = this.paneReads.get(paneId);
		if (previous?.fingerprint === fingerprint) {
			return await previous.value;
		}
		const metadata = z
			.object({ type: z.literal("session_meta"), payload: z.object({ id: z.string() }) })
			.parse(
				JSON.parse((await Bun.file(source.path).slice(0, 1_000_000).text()).split("\n", 1)[0]!),
			);
		const threadId = metadata.payload.id;
		if (agent.sessionId && agent.sessionId !== threadId) {
			throw new ORPCError("CONFLICT", {
				message: "A sessão deste pane mudou. Aguarde o radar atualizar.",
			});
		}
		const value = this.readPaneThread({
			home,
			threadId,
			cwd: agent.cwd,
			working: agent.status === "working",
		});
		this.paneReads.set(paneId, { fingerprint, value });
		try {
			return await value;
		} catch (error) {
			if (this.paneReads.get(paneId)?.value === value) {
				this.paneReads.delete(paneId);
			}
			throw error;
		}
	}

	async *watchPane(paneId: string, signal?: AbortSignal) {
		let previous: Awaited<ReturnType<ConversationsRuntime["readPane"]>> | undefined;
		let lastError: string | undefined;
		try {
			while (!signal?.aborted) {
				try {
					const data = await this.readPane(paneId);
					if (signal?.aborted) {
						return;
					}
					if (!isDeepStrictEqual(data, previous) || lastError) {
						previous = data;
						lastError = undefined;
						yield { type: "snapshot" as const, data };
					}
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Não foi possível ler a conversa do Codex.";
					if (message !== lastError) {
						lastError = message;
						yield { type: "error" as const, message };
					}
				}
				try {
					await waitForChange(1000, undefined, { signal });
				} catch (error) {
					if (!signal?.aborted) {
						throw error;
					}
				}
			}
		} finally {
			this.paneReads.delete(paneId);
		}
	}

	private async readPaneThread(input: {
		home: string;
		threadId: string;
		cwd: string;
		working: boolean;
	}) {
		const existing = this.readers.get(input.home);
		const server =
			existing ??
			new CodexAppServer(
				"default",
				async (event) => {
					if (event.id !== undefined) {
						await server.rejectRequest(event.id);
					}
				},
				() => {
					if (this.readers.get(input.home) === server) {
						this.readers.delete(input.home);
						this.paneReads.clear();
					}
					return Promise.resolve();
				},
				{ codexHome: input.home },
			);
		this.readers.set(input.home, server);
		await server.ready;
		const { thread } = z
			.object({ thread: CodexThreadSchema })
			.parse(await server.call("thread/read", { threadId: input.threadId, includeTurns: true }));
		if (thread.id !== input.threadId) {
			throw new ORPCError("CONFLICT", {
				message: "O Codex retornou outro histórico para este pane.",
			});
		}
		const last = thread.turns.at(-1);
		if (input.working && last?.status === "interrupted" && !last.completedAt) {
			last.status = "inProgress";
		}
		return {
			threadId: thread.id,
			cwd: thread.cwd ?? input.cwd,
			model: thread.model ?? null,
			effort: thread.reasoningEffort ?? null,
			projection: {
				turns: thread.turns,
				activeTurnId: thread.turns.findLast((turn) => turn.status === "inProgress")?.id ?? null,
				requests: [],
				diff: "",
				error: null,
			} satisfies ConversationProjection,
		};
	}

	async models(profileId: ProfileId) {
		const server = await this.server(profileId);
		return CodexModelListSchema.parse(
			await server.call("model/list", { includeHidden: false, limit: 100 }),
		).data.filter((model) => !model.hidden);
	}

	async cliHistory(input: ConversationHistoryInput) {
		const projects = await dbProjects.getAll();
		if (!projects.some((project) => project.id === input.projectId)) {
			throw new ORPCError("NOT_FOUND", { message: "Projeto não encontrado." });
		}
		const server = await this.server(input.profileId);
		const response = CodexHistoryListSchema.parse(
			await server.call("thread/list", {
				limit: 100,
				sortKey: "updated_at",
				sortDirection: "desc",
				sourceKinds: ["cli", "vscode", "exec", "appServer"],
				...(input.cursor ? { cursor: input.cursor } : {}),
				...(input.search ? { searchTerm: input.search } : {}),
			}),
		);
		const threads = response.data.filter(
			(thread) => matchProjectByCwd(projects, thread.cwd)?.id === input.projectId,
		);
		const linked = await DbConversations.linkedThreads(
			input.profileId,
			threads.map((thread) => thread.id),
		);
		const linkedIds = new Set(linked.map((row) => row.thread_id));
		return {
			threads: threads
				.filter((thread) => !linkedIds.has(thread.id))
				.map((thread) => ({
					threadId: thread.id,
					title:
						[thread.name, thread.preview].find((value) => !!value?.trim()) ?? "Conversa do Codex",
					preview: thread.preview,
					updatedAt: thread.updatedAt,
					livePaneId: liveCodexPane(thread.id),
				})),
			nextCursor: response.nextCursor,
		};
	}

	async importCli(userId: number, input: ConversationImportInput) {
		return await this.serial(`${input.profileId}:${input.threadId}`, async () => {
			const projects = await dbProjects.getAll();
			const server = await this.server(input.profileId);
			const { thread } = CodexHistoryReadSchema.parse(
				await server.call("thread/read", { threadId: input.threadId, includeTurns: true }),
			);
			if (
				thread.id !== input.threadId ||
				matchProjectByCwd(projects, thread.cwd)?.id !== input.projectId
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Esta conversa não pertence ao projeto selecionado.",
				});
			}
			const paneId = liveCodexPane(thread.id);
			if (paneId) {
				return { id: null, paneId };
			}
			const id = await DbConversations.importCli(userId, input, thread);
			await this.publish(id, userId);
			return { id, paneId: null };
		});
	}

	async create(userId: number, input: ConversationCreateInput) {
		const project = await dbProjects.getById(input.projectId);
		if (!project || !(await stat(project.main_route)).isDirectory()) {
			throw new ORPCError("NOT_FOUND", {
				message: "O diretório deste projeto não está disponível.",
			});
		}
		const server = await this.server(input.profileId);
		const permission = CONVERSATION_PERMISSIONS.find((entry) => entry.id === input.permissionMode)!;
		const response = CodexThreadResponseSchema.parse(
			await server.call("thread/start", {
				cwd: project.main_route,
				model: input.model,
				approvalPolicy: permission.approvalPolicy,
				sandbox: permission.sandbox,
				approvalsReviewer: "user",
				historyMode: "legacy",
				ephemeral: false,
			}),
		);
		const id = await DbConversations.create(userId, input, project.main_route);
		await DbConversations.update(id, userId, {
			thread_id: response.thread.id,
			model: response.model,
			...(response.reasoningEffort ? { effort: response.reasoningEffort } : {}),
		});
		const detail = await DbConversations.get(id, userId);
		this.loaded.set(id, {
			userId,
			profileId: input.profileId,
			threadId: response.thread.id,
			projection: detail.projection,
		});
		return await this.publish(id, userId);
	}

	async get(id: string, userId: number) {
		return await this.serial(id, async () => {
			const detail = await DbConversations.get(id, userId);
			if (this.loaded.has(id) && !(detail.threadId && liveCodexPane(detail.threadId))) {
				return detail;
			}
			try {
				const server = await this.server(detail.profileId);
				const loaded = await this.load(detail, server, userId);
				await this.persist(id, loaded);
				return await DbConversations.get(id, userId);
			} catch (error) {
				return {
					...detail,
					projection: {
						...detail.projection,
						activeTurnId: null,
						requests: [],
						error: error instanceof Error ? error.message : "Não foi possível retomar o Codex.",
					},
				};
			}
		});
	}

	async rename(id: string, userId: number, title: string) {
		await DbConversations.get(id, userId);
		await DbConversations.update(id, userId, { title });
		return await this.publish(id, userId);
	}

	async send(userId: number, input: ConversationSendInput) {
		return await this.serial(input.id, async () => {
			const detail = await DbConversations.get(input.id, userId);
			const previous = detail.messages.find((message) => message.id === input.clientMessageId);
			if (previous) {
				if (previous.text !== input.text) {
					throw new ORPCError("CONFLICT", {
						message: "Esta mensagem já foi usada em outro envio.",
					});
				}
				if (previous.status !== "failed") {
					return detail;
				}
			}
			const server = await this.server(detail.profileId);
			const loaded = await this.load(detail, server, userId);
			const activeTurnId = loaded.projection.activeTurnId;
			if (
				(input.expectedTurnId && input.expectedTurnId !== activeTurnId) ||
				(activeTurnId && !input.expectedTurnId)
			) {
				throw new ORPCError("CONFLICT", {
					message: "A execução mudou. Confira a conversa antes de enviar novamente.",
				});
			}
			if (previous) {
				await DbConversations.setMessage(input.id, input.clientMessageId, "sending", {});
			} else {
				await DbConversations.enqueue(input.id, input.clientMessageId, input.text);
			}
			await this.publish(input.id, userId);
			try {
				const params = {
					threadId: detail.threadId,
					clientUserMessageId: input.clientMessageId,
					input: [{ type: "text", text: input.text, text_elements: [] }],
				};
				const result = await server.call(activeTurnId ? "turn/steer" : "turn/start", {
					...params,
					...(activeTurnId
						? { expectedTurnId: activeTurnId }
						: { model: input.model ?? detail.model, effort: input.effort ?? detail.effort }),
				});
				await this.events;
				const turnId = activeTurnId
					? z.object({ turnId: z.string() }).parse(result).turnId
					: z.object({ turn: CodexTurnSchema }).parse(result).turn.id;
				await DbConversations.setMessage(input.id, input.clientMessageId, "accepted", { turnId });
				if (!activeTurnId && !loaded.projection.turns.some((turn) => turn.id === turnId)) {
					applyCodexEvent(
						loaded.projection,
						{
							method: "turn/started",
							params: {
								threadId: detail.threadId,
								turn: z.object({ turn: CodexTurnSchema }).parse(result).turn,
							},
						},
						server.runtimeId,
					);
				}
				await DbConversations.update(input.id, userId, {
					...(detail.title === "Nova conversa" ? { title: input.text.slice(0, 80) } : {}),
					...(input.model ? { model: input.model } : {}),
					...(input.effort ? { effort: input.effort } : {}),
				});
				await this.persist(input.id, loaded);
			} catch (error) {
				await DbConversations.setMessage(
					input.id,
					input.clientMessageId,
					error instanceof Error && error.name === "CodexRpcError" ? "failed" : "uncertain",
					{ error: error instanceof Error ? error.message : "Falha ao enviar mensagem." },
				);
			}
			return await this.publish(input.id, userId);
		});
	}

	async reconcile(id: string, userId: number) {
		return await this.serial(id, async () => {
			const detail = await DbConversations.get(id, userId);
			const server = await this.server(detail.profileId);
			const loaded = await this.load(detail, server, userId);
			await server.call(
				"thread/read",
				{ threadId: detail.threadId, includeTurns: true },
				(result) =>
					this.snapshot(loaded, z.object({ thread: CodexThreadSchema }).parse(result).thread),
			);
			loaded.projection.error = null;
			await this.persist(id, loaded);
			return await DbConversations.get(id, userId);
		});
	}

	async interrupt(id: string, userId: number) {
		const detail = await DbConversations.get(id, userId);
		const loaded = this.loaded.get(id);
		if (!loaded?.projection.activeTurnId) {
			throw new ORPCError("CONFLICT", { message: "Não há uma execução ativa nesta conversa." });
		}
		const server = await this.server(detail.profileId);
		await server.call("turn/interrupt", {
			threadId: detail.threadId,
			turnId: loaded.projection.activeTurnId,
		});
		return { interrupted: true };
	}

	async respond(userId: number, input: ConversationRespondInput) {
		const detail = await DbConversations.get(input.id, userId);
		const loaded = this.loaded.get(input.id);
		const server = this.servers.get(detail.profileId);
		const request = loaded?.projection.requests.find(
			(entry) => entry.id === input.requestId && entry.runtimeId === input.runtimeId,
		);
		if (!server || server.runtimeId !== input.runtimeId || !request || !loaded) {
			throw new ORPCError("CONFLICT", {
				message: "Este pedido foi encerrado. Atualize a conversa.",
			});
		}
		if (request.questions) {
			if (
				!input.answers ||
				request.questions.some((question) => !input.answers?.[question.id]?.length)
			) {
				throw new ORPCError("BAD_REQUEST", { message: "Responda a todas as perguntas." });
			}
			await server.respond(request.id, {
				answers: Object.fromEntries(
					Object.entries(input.answers).map(([key, answers]) => [key, { answers }]),
				),
			});
		} else if (request.method === "item/permissions/requestApproval") {
			if (!input.decision) {
				throw new ORPCError("BAD_REQUEST", { message: "Escolha se deseja permitir este acesso." });
			}
			await server.respond(
				request.id,
				permissionResponse(
					this.rawRequests.get(`${server.runtimeId}:${request.id}`),
					input.decision === "accept",
				),
			);
		} else {
			if (!input.decision || !request.decisions?.includes(input.decision)) {
				throw new ORPCError("BAD_REQUEST", { message: "Escolha uma decisão disponível." });
			}
			await server.respond(request.id, { decision: input.decision });
		}
		this.rawRequests.delete(`${server.runtimeId}:${request.id}`);
		loaded.projection.requests = loaded.projection.requests.filter(
			(entry) => entry.id !== request.id,
		);
		await this.persist(input.id, loaded);
		return { answered: true };
	}

	close() {
		for (const server of [...this.servers.values(), ...this.readers.values()]) {
			server.close();
		}
	}
}

export const conversationsRuntime = new ConversationsRuntime();
