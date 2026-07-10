import { db, type execution_runs } from "./connection";

type ExecutionRunCreate = Pick<
	execution_runs,
	"id" | "user_id" | "project_id" | "kind" | "title" | "status" | "started_at" | "updated_at"
> &
	Partial<Pick<execution_runs, "task_id" | "prompt">>;

type ExecutionRunUpdate = Partial<
	Pick<execution_runs, "status" | "stage" | "agent" | "output" | "error" | "finished_at">
>;

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
			.executeTakeFirst();
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
