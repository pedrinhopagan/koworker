import { db, type execution_runs } from "./connection";

type ExecutionRunCreate = Pick<
	execution_runs,
	"id" | "user_id" | "project_id" | "kind" | "title" | "status" | "started_at" | "updated_at"
> &
	Partial<
		Pick<
			execution_runs,
			| "task_id"
			| "client_request_id"
			| "request_fingerprint"
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
		"status" | "title" | "prompt" | "stage" | "agent" | "output" | "error" | "finished_at"
	>
> & { task_id?: string | null };

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
