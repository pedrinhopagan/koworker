import type {
	ExecutionMessageDbCreateInput,
	ExecutionThreadDbCreateInput,
} from "../schemas/execution";
import { db } from "./connection";
import { cleanUpdate } from "./helpers";

export const dbExecution = {
	getThreadByTaskId: (taskId: string) =>
		db
			.selectFrom("execution_threads")
			.selectAll()
			.where("task_id", "=", taskId)
			.executeTakeFirst(),

	getMessagesByThreadId: (threadId: string) =>
		db
			.selectFrom("execution_messages")
			.selectAll()
			.where("thread_id", "=", threadId)
			.orderBy("created_at", "asc")
			.execute(),

	getByTaskId: async (taskId: string) => {
		const thread = await dbExecution.getThreadByTaskId(taskId);
		if (!thread) {
			return { thread: null, messages: [] as any[] };
		}

		const messages = await dbExecution.getMessagesByThreadId(thread.id);
		return { thread, messages };
	},

	getOrCreateThreadByTaskId: async (input: Pick<ExecutionThreadDbCreateInput, "id" | "task_id">) => {
		// Thread is unique by task_id, so we can safely upsert-ish using onConflict.
		await db
			.insertInto("execution_threads")
			.values({ id: input.id, task_id: input.task_id, created_at: Date.now() })
			.onConflict((oc) => oc.column("task_id").doNothing())
			.executeTakeFirst();

		return dbExecution.getThreadByTaskId(input.task_id);
	},

	createMessage: (input: {
		taskId: string;
		threadId?: string;
		threadCreate: Pick<ExecutionThreadDbCreateInput, "id" | "task_id">;
		messageCreate: Omit<ExecutionMessageDbCreateInput, "thread_id" | "created_at">;
	}) => {
		return db.transaction().execute(async (trx) => {
			let thread = await trx
				.selectFrom("execution_threads")
				.selectAll()
				.where("task_id", "=", input.taskId)
				.executeTakeFirst();

			if (!thread) {
				await trx
					.insertInto("execution_threads")
					.values({
						id: input.threadCreate.id,
						task_id: input.threadCreate.task_id,
						created_at: Date.now(),
					})
					.onConflict((oc) => oc.column("task_id").doNothing())
					.executeTakeFirst();

				thread = await trx
					.selectFrom("execution_threads")
					.selectAll()
					.where("task_id", "=", input.taskId)
					.executeTakeFirst();
			}

			if (!thread) throw new Error("Failed to get-or-create execution thread");

			const cleanMessageValues = cleanUpdate({
				...input.messageCreate,
				thread_id: thread.id,
				created_at: Date.now(),
			});

			await trx
				.insertInto("execution_messages")
				.values(cleanMessageValues as any)
				.executeTakeFirst();

			await trx
				.updateTable("execution_threads")
				.set({ updated_at: Date.now() })
				.where("id", "=", thread.id)
				.executeTakeFirst();

			return thread;
		});
	},
};
