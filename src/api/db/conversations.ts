import { sql } from "kysely";
import { ORPCError } from "@orpc/server";
import type { z } from "zod";
import { db } from "@/api/db/connection";
import {
	ConversationEffortSchema,
	ConversationMessageStatusSchema,
	ConversationPermissionSchema,
	ConversationProfileSchema,
	ConversationProjectionSchema,
	CodexHistoryReadSchema,
	emptyConversationProjection,
	type ConversationProjection,
} from "@/lib/conversation";
import type { ConversationCreateInput, ConversationImportInput } from "@/api/schemas/conversations";
import { CONVERSATION_DEFAULT_PERMISSION } from "@/constants/conversation";

export const DbConversations = {
	async recover() {
		await db
			.updateTable("conversations")
			.set({
				projection: sql<string>`json_set(projection, '$.activeTurnId', NULL, '$.requests', json('[]'), '$.error', CASE WHEN json_extract(projection, '$.activeTurnId') IS NOT NULL THEN 'A execução foi interrompida pelo reinício do servidor. Confira o histórico antes de continuar.' ELSE json_extract(projection, '$.error') END)`,
				revision: sql`revision + 1`,
			})
			.where((eb) =>
				eb.or([
					eb(sql<string | null>`json_extract(projection, '$.activeTurnId')`, "is not", null),
					eb(sql<number>`json_array_length(json_extract(projection, '$.requests'))`, ">", 0),
				]),
			)
			.execute();
		await db
			.updateTable("conversation_messages")
			.set({
				status: "uncertain",
				error: "O envio foi interrompido antes da confirmação. Confira o histórico.",
				updated_at: Date.now(),
			})
			.where("status", "=", "sending")
			.execute();
	},
	async list(userId: number) {
		const rows = await db
			.selectFrom("conversations as c")
			.innerJoin("projects as p", "p.id", "c.project_id")
			.select([
				sql<
					string | null
				>`coalesce(json_extract(c.projection, '$.turns[#-1].items[#-1].text'), json_extract(c.projection, '$.turns[#-1].items[#-1].command'))`.as(
					"preview",
				),
				"c.id",
				"c.title",
				"c.profile_id",
				"c.thread_id",
				"c.project_id",
				"p.name as project_name",
				"c.updated_at",
			])
			.select([
				sql<string | null>`json_extract(c.projection, '$.activeTurnId')`.as("active_turn_id"),
				sql<number>`json_array_length(json_extract(c.projection, '$.requests'))`.as(
					"request_count",
				),
			])
			.where("c.user_id", "=", userId)
			.orderBy("c.updated_at", "desc")
			.execute();

		return rows.map((row) => {
			return {
				id: row.id,
				title: row.title,
				profileId: ConversationProfileSchema.parse(row.profile_id),
				threadId: row.thread_id ?? null,
				projectId: row.project_id,
				projectName: row.project_name,
				updatedAt: row.updated_at,
				busy: !!row.active_turn_id,
				waiting: row.request_count > 0,
				preview: row.preview,
			};
		});
	},
	async linkedThreads(profileId: z.infer<typeof ConversationProfileSchema>, threadIds: string[]) {
		if (threadIds.length === 0) {
			return [];
		}
		return await db
			.selectFrom("conversations as c")
			.select(["c.id", "c.user_id", "c.thread_id"])
			.where("c.profile_id", "=", profileId)
			.where("c.thread_id", "in", threadIds)
			.execute();
	},
	async importCli(
		userId: number,
		input: ConversationImportInput,
		thread: z.infer<typeof CodexHistoryReadSchema>["thread"],
	) {
		const id = crypto.randomUUID();
		await db
			.insertInto("conversations")
			.values({
				id,
				user_id: userId,
				project_id: input.projectId,
				profile_id: input.profileId,
				thread_id: thread.id,
				title:
					[thread.name, thread.preview]
						.find((value) => !!value?.trim())
						?.trim()
						.slice(0, 200) ?? "Conversa do Codex",
				cwd: thread.cwd,
				model: thread.model,
				effort: thread.reasoningEffort,
				permission_mode: CONVERSATION_DEFAULT_PERMISSION,
				projection: JSON.stringify({ ...emptyConversationProjection(), turns: thread.turns }),
				revision: 0,
				created_at: thread.createdAt,
				updated_at: thread.updatedAt,
			})
			.onConflict((conflict) => conflict.doNothing())
			.execute();
		const row = await db
			.selectFrom("conversations as c")
			.select("c.id")
			.where("c.profile_id", "=", input.profileId)
			.where("c.thread_id", "=", thread.id)
			.where("c.user_id", "=", userId)
			.executeTakeFirst();
		if (!row) {
			throw new ORPCError("FORBIDDEN", {
				message: "Esta conversa já pertence a outro usuário do Kowork.",
			});
		}
		return row.id;
	},
	async get(id: string, userId: number) {
		const row = await db
			.selectFrom("conversations as c")
			.innerJoin("projects as p", "p.id", "c.project_id")
			.selectAll("c")
			.select("p.name as project_name")
			.where("c.id", "=", id)
			.where("c.user_id", "=", userId)
			.executeTakeFirst();

		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "Conversa não encontrada" });
		}

		const messages = await db
			.selectFrom("conversation_messages as m")
			.selectAll("m")
			.where("m.conversation_id", "=", id)
			.orderBy("m.created_at", "asc")
			.execute();

		return {
			id: row.id,
			title: row.title,
			profileId: ConversationProfileSchema.parse(row.profile_id),
			threadId: row.thread_id ?? null,
			projectId: row.project_id,
			projectName: row.project_name,
			cwd: row.cwd,
			model: row.model ?? null,
			effort: row.effort ? ConversationEffortSchema.parse(row.effort) : null,
			permissionMode: ConversationPermissionSchema.parse(row.permission_mode),
			revision: row.revision,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			projection: ConversationProjectionSchema.parse(JSON.parse(row.projection)),
			messages: messages.map((message) => ({
				id: message.id,
				text: message.text,
				status: ConversationMessageStatusSchema.parse(message.status),
				turnId: message.turn_id ?? null,
				error: message.error ?? null,
			})),
		};
	},
	async create(userId: number, input: ConversationCreateInput, cwd: string) {
		const id = crypto.randomUUID();
		const now = Date.now();
		await db
			.insertInto("conversations")
			.values({
				id,
				user_id: userId,
				project_id: input.projectId,
				profile_id: input.profileId,
				title: "Nova conversa",
				cwd,
				permission_mode: input.permissionMode,
				projection: JSON.stringify(emptyConversationProjection()),
				revision: 0,
				model: input.model,
				effort: input.effort,
				created_at: now,
				updated_at: now,
			})
			.execute();
		return id;
	},
	async update(
		id: string,
		userId: number,
		values: { title?: string; thread_id?: string; model?: string; effort?: string },
	) {
		await db
			.updateTable("conversations")
			.set({ ...values, revision: sql`revision + 1`, updated_at: Date.now() })
			.where("id", "=", id)
			.where("user_id", "=", userId)
			.execute();
	},
	async saveProjection(id: string, projection: ConversationProjection) {
		await db
			.updateTable("conversations")
			.set({
				projection: JSON.stringify(projection),
				revision: sql`revision + 1`,
				updated_at: Date.now(),
			})
			.where("id", "=", id)
			.execute();
		const receipts = projection.turns.flatMap((turn) =>
			turn.items
				.filter((item) => item.type === "userMessage" && item.clientId)
				.map((item) => ({ id: item.clientId, turnId: turn.id })),
		);
		for (const receipt of receipts) {
			await db
				.updateTable("conversation_messages")
				.set({ status: "confirmed", turn_id: receipt.turnId, error: null, updated_at: Date.now() })
				.where("conversation_id", "=", id)
				.where("id", "=", receipt.id!)
				.where("status", "!=", "confirmed")
				.execute();
		}
	},
	async enqueue(id: string, clientMessageId: string, text: string) {
		const now = Date.now();
		await db
			.insertInto("conversation_messages")
			.values({
				id: clientMessageId,
				conversation_id: id,
				text,
				status: "sending",
				created_at: now,
				updated_at: now,
			})
			.execute();
	},
	async setMessage(
		id: string,
		clientMessageId: string,
		status: "sending" | "accepted" | "uncertain" | "failed",
		values: { turnId?: string; error?: string },
	) {
		await db
			.updateTable("conversation_messages")
			.set({ status, turn_id: values.turnId, error: values.error, updated_at: Date.now() })
			.where("conversation_id", "=", id)
			.where("id", "=", clientMessageId)
			.where("status", "!=", "confirmed")
			.execute();
	},
};

export type ConversationDetail = Awaited<ReturnType<typeof DbConversations.get>>;
