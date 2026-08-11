import { type agent_sessions, db } from "./connection";

type AgentSessionCreate = Pick<
	agent_sessions,
	| "id"
	| "user_id"
	| "project_id"
	| "title"
	| "cli"
	| "cwd"
	| "status"
	| "permission_mode"
	| "started_at"
	| "updated_at"
> &
	Partial<Pick<agent_sessions, "task_id" | "model" | "effort" | "agent" | "pid" | "heartbeat_at">>;

type AgentSessionUpdate = Partial<
	Pick<
		agent_sessions,
		"status" | "title" | "permission_mode" | "heartbeat_at" | "end_reason" | "cli_session_id"
	>
> & { pid?: number | null; ended_at?: number | null };

export const dbAgentSessions = {
	async create(input: AgentSessionCreate) {
		await db.insertInto("agent_sessions").values(input).execute();

		return db
			.selectFrom("agent_sessions as s")
			.selectAll("s")
			.where("s.id", "=", input.id)
			.executeTakeFirstOrThrow();
	},

	// Sessões que o koworker abriu e sabe a qual tarefa pertencem. No claude o `id` é o próprio
	// `--session-id` do CLI; no codex quem casa com o rollout é o `cli_session_id`.
	listCliLinks() {
		return db
			.selectFrom("agent_sessions as s")
			.leftJoin("tasks as t", "t.id", "s.task_id")
			.select([
				"s.id",
				"s.cli",
				"s.cli_session_id",
				"s.task_id",
				"s.project_id",
				"t.title as task_title",
			])
			.where("s.task_id", "is not", null)
			.execute();
	},

	getByIdForUser(id: string, userId: number) {
		return db
			.selectFrom("agent_sessions as s")
			.selectAll("s")
			.where("s.id", "=", id)
			.where("s.user_id", "=", userId)
			.where("s.deleted_at", "is", null)
			.executeTakeFirst();
	},

	getDetailedByIdForUser(id: string, userId: number) {
		return db
			.selectFrom("agent_sessions as s")
			.leftJoin("projects as p", "p.id", "s.project_id")
			.leftJoin("tasks as t", "t.id", "s.task_id")
			.selectAll("s")
			.select([
				"p.name as project_name",
				"p.main_route as project_main_route",
				"t.title as task_title",
				"t.folder_path as task_folder_path",
			])
			.where("s.id", "=", id)
			.where("s.user_id", "=", userId)
			.where("s.deleted_at", "is", null)
			.executeTakeFirst();
	},

	listForUser(userId: number, limit: number) {
		return db
			.selectFrom("agent_sessions as s")
			.leftJoin("projects as p", "p.id", "s.project_id")
			.leftJoin("tasks as t", "t.id", "s.task_id")
			.selectAll("s")
			.select(["p.name as project_name", "t.title as task_title"])
			.where("s.user_id", "=", userId)
			.where("s.deleted_at", "is", null)
			.orderBy("s.started_at", "desc")
			.limit(limit)
			.execute();
	},

	getLiveForTask(taskId: string) {
		return db
			.selectFrom("agent_sessions as s")
			.selectAll("s")
			.where("s.task_id", "=", taskId)
			.where("s.status", "=", "live")
			.where("s.deleted_at", "is", null)
			.executeTakeFirst();
	},

	async update(id: string, input: AgentSessionUpdate) {
		await db
			.updateTable("agent_sessions")
			.set({ ...input, updated_at: Date.now() })
			.where("id", "=", id)
			.execute();

		return db
			.selectFrom("agent_sessions as s")
			.selectAll("s")
			.where("s.id", "=", id)
			.executeTakeFirstOrThrow();
	},

	// Só quem encontra a sessão ainda viva grava o encerramento: o processo pode morrer no mesmo
	// instante em que o usuário encerra, e o segundo a chegar sobrescreveria o motivo real.
	async endIfLive(id: string, input: { status: "ended" | "crashed"; reason: string }) {
		const now = Date.now();
		const result = await db
			.updateTable("agent_sessions")
			.set({ status: input.status, end_reason: input.reason, ended_at: now, updated_at: now })
			.where("id", "=", id)
			.where("status", "=", "live")
			.executeTakeFirst();

		return Number(result.numUpdatedRows) > 0;
	},

	touchHeartbeat(ids: string[]) {
		if (ids.length === 0) {
			return Promise.resolve();
		}

		const now = Date.now();

		return db
			.updateTable("agent_sessions")
			.set({ heartbeat_at: now, updated_at: now })
			.where("id", "in", ids)
			.where("status", "=", "live")
			.execute();
	},

	// Sessões `live` sem sinal de vida: o executor que as iniciou morreu (crash, kill, deploy). Sem
	// isso a sessão fica viva para sempre, porque o processo só existe na memória do executor.
	listStale(heartbeatBefore: number) {
		return db
			.selectFrom("agent_sessions as s")
			.selectAll("s")
			.where("s.status", "=", "live")
			.where("s.deleted_at", "is", null)
			.where((eb) =>
				eb.or([eb("s.heartbeat_at", "is", null), eb("s.heartbeat_at", "<", heartbeatBefore)]),
			)
			.execute();
	},

	async softDeleteForUser(ids: string[], userId: number) {
		const result = await db
			.updateTable("agent_sessions")
			.set({ deleted_at: Date.now(), updated_at: Date.now() })
			.where("id", "in", ids)
			.where("user_id", "=", userId)
			.where("status", "!=", "live")
			.where("deleted_at", "is", null)
			.executeTakeFirst();

		return Number(result.numUpdatedRows);
	},
};
