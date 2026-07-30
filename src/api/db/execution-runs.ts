import { db, type execution_runs } from "./connection";

type ExecutionRunCreate = Pick<
	execution_runs,
	| "id"
	| "user_id"
	| "project_id"
	| "kind"
	| "title"
	| "status"
	| "started_at"
	| "updated_at"
	| "heartbeat_at"
> &
	Partial<
		Pick<
			execution_runs,
			| "task_id"
			| "session_id"
			| "client_request_id"
			| "request_fingerprint"
			| "parent_run_id"
			| "cli_session_id"
			| "create_task_title"
			| "prompt"
			| "original_prompt"
			| "source"
			| "interaction_mode"
			| "input_kind"
			| "cli"
			| "permission_mode"
			| "agent"
			| "model"
			| "effort"
			| "approval_mode"
		>
	>;

type ExecutionRunUpdate = Partial<
	Pick<
		execution_runs,
		| "status"
		| "title"
		| "prompt"
		| "stage"
		| "agent"
		| "output"
		| "error"
		| "finished_at"
		| "heartbeat_at"
		| "cli_session_id"
	>
> & { task_id?: string | null; create_task_title?: string | null };

export const dbExecutionRuns = {
	async create(input: ExecutionRunCreate) {
		await db.insertInto("execution_runs").values(input).execute();

		return db
			.selectFrom("execution_runs as er")
			.selectAll("er")
			.where("er.id", "=", input.id)
			.executeTakeFirstOrThrow();
	},

	getByIdForUser(id: string, userId: number) {
		return db
			.selectFrom("execution_runs as er")
			.selectAll("er")
			.where("er.id", "=", id)
			.where("er.user_id", "=", userId)
			.where("er.deleted_at", "is", null)
			.executeTakeFirst();
	},

	getDetailedByIdForUser(id: string, userId: number) {
		return db
			.selectFrom("execution_runs as er")
			.leftJoin("projects as p", "p.id", "er.project_id")
			.leftJoin("tasks as t", "t.id", "er.task_id")
			.selectAll("er")
			.select([
				"p.name as project_name",
				"t.title as task_title",
				"t.folder_path as task_folder_path",
			])
			.where("er.id", "=", id)
			.where("er.user_id", "=", userId)
			.where("er.kind", "=", "prompt")
			.where("er.deleted_at", "is", null)
			.executeTakeFirst();
	},

	getByRequestIdForUser(clientRequestId: string, userId: number) {
		return db
			.selectFrom("execution_runs as er")
			.selectAll("er")
			.where("er.client_request_id", "=", clientRequestId)
			.where("er.user_id", "=", userId)
			.executeTakeFirst();
	},

	listForUser(userId: number, limit: number) {
		return db
			.selectFrom("execution_runs as er")
			.leftJoin("projects as p", "p.id", "er.project_id")
			.leftJoin("tasks as t", "t.id", "er.task_id")
			.selectAll("er")
			.select(["p.name as project_name", "t.title as task_title"])
			.where("er.user_id", "=", userId)
			.where("er.kind", "=", "prompt")
			.where("er.deleted_at", "is", null)
			.orderBy("er.started_at", "desc")
			.limit(limit)
			.execute();
	},

	// Todos os turnos de uma conversa compartilham o `cli_session_id`: o primeiro run cria a sessão e
	// cada continuação herda a mesma. Ordem cronológica porque a tela é uma conversa, não um histórico.
	listThreadForUser(cliSessionId: string, userId: number) {
		return db
			.selectFrom("execution_runs as er")
			.leftJoin("projects as p", "p.id", "er.project_id")
			.leftJoin("tasks as t", "t.id", "er.task_id")
			.selectAll("er")
			.select(["p.name as project_name", "t.title as task_title"])
			.where("er.cli_session_id", "=", cliSessionId)
			.where("er.user_id", "=", userId)
			.where("er.kind", "=", "prompt")
			.where("er.deleted_at", "is", null)
			.orderBy("er.started_at", "asc")
			.execute();
	},

	async softDeleteFinishedForUser(ids: string[], userId: number) {
		const result = await db
			.updateTable("execution_runs")
			.set({ deleted_at: Date.now(), updated_at: Date.now() })
			.where("id", "in", ids)
			.where("user_id", "=", userId)
			.where("kind", "=", "prompt")
			.where("status", "!=", "running")
			.where("deleted_at", "is", null)
			.executeTakeFirst();

		return Number(result.numUpdatedRows);
	},

	getLatestFlowForTask(taskId: string, userId: number) {
		return db
			.selectFrom("execution_runs as er")
			.selectAll("er")
			.where("er.task_id", "=", taskId)
			.where("er.user_id", "=", userId)
			.where("er.kind", "=", "flow")
			.orderBy("er.started_at", "desc")
			.limit(1)
			.executeTakeFirst();
	},

	// Só quem encontra o run ainda `running` grava o desfecho. O processo pode terminar no mesmo
	// instante em que o usuário cancela ou em que outro executor reconcilia — sem esta condição o
	// segundo a chegar sobrescreveria o resultado real.
	async finishIfRunning(
		id: string,
		input: Pick<
			ExecutionRunUpdate,
			"status" | "output" | "error" | "cli_session_id" | "stage" | "agent"
		>,
	) {
		const now = Date.now();
		const result = await db
			.updateTable("execution_runs")
			.set({ ...input, finished_at: now, updated_at: now })
			.where("id", "=", id)
			.where("status", "=", "running")
			.executeTakeFirst();

		return Number(result.numUpdatedRows) > 0;
	},

	async updateIfRunning(id: string, input: ExecutionRunUpdate) {
		const result = await db
			.updateTable("execution_runs")
			.set({ ...input, updated_at: Date.now() })
			.where("id", "=", id)
			.where("status", "=", "running")
			.executeTakeFirst();

		return Number(result.numUpdatedRows) > 0;
	},

	touchHeartbeat(ids: string[]) {
		if (ids.length === 0) {
			return Promise.resolve();
		}

		const now = Date.now();

		return db
			.updateTable("execution_runs")
			.set({ heartbeat_at: now, updated_at: now })
			.where("id", "in", ids)
			.where("status", "=", "running")
			.execute();
	},

	// Runs `running` sem sinal de vida: o executor que os iniciou morreu (crash, kill, deploy) ou o
	// run passou do teto absoluto. Sem isso o registro fica "em andamento" para sempre, porque o
	// controle do processo vive na memória do executor.
	listStale(input: {
		heartbeatBefore: number;
		promptStartedBefore: number;
		flowStartedBefore: number;
	}) {
		return db
			.selectFrom("execution_runs as er")
			.selectAll("er")
			.where("er.status", "=", "running")
			.where("er.deleted_at", "is", null)
			.where((eb) =>
				eb.or([
					eb("er.heartbeat_at", "is", null),
					eb("er.heartbeat_at", "<", input.heartbeatBefore),
					eb.and([
						eb("er.kind", "=", "prompt"),
						eb("er.started_at", "<", input.promptStartedBefore),
					]),
					eb.and([eb("er.kind", "=", "flow"), eb("er.started_at", "<", input.flowStartedBefore)]),
				]),
			)
			.execute();
	},

	listRunningTaskIds(projectId: string, taskIds: string[]) {
		if (taskIds.length === 0) {
			return Promise.resolve([]);
		}

		return db
			.selectFrom("execution_runs as er")
			.select("er.task_id")
			.where("er.project_id", "=", projectId)
			.where("er.task_id", "in", taskIds)
			.where("er.status", "=", "running")
			.where("er.deleted_at", "is", null)
			.execute();
	},

	listRunningForTask(projectId: string, taskId: string) {
		return db
			.selectFrom("execution_runs as er")
			.select(["er.id", "er.started_at"])
			.where("er.project_id", "=", projectId)
			.where("er.task_id", "=", taskId)
			.where("er.status", "=", "running")
			.where("er.deleted_at", "is", null)
			.execute();
	},

	async update(id: string, input: ExecutionRunUpdate) {
		await db
			.updateTable("execution_runs")
			.set({ ...input, updated_at: Date.now() })
			.where("id", "=", id)
			.execute();

		return db
			.selectFrom("execution_runs as er")
			.selectAll("er")
			.where("er.id", "=", id)
			.executeTakeFirstOrThrow();
	},
};
