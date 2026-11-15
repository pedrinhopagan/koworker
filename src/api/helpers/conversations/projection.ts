import { z } from "zod";
import {
	CodexItemSchema,
	CodexTurnSchema,
	ConversationQuestionSchema,
	type ConversationProjection,
	type ConversationRequest,
} from "@/lib/conversation";
import type { CodexEnvelope } from "@/api/helpers/conversations/app-server";

const scopeSchema = z.object({ threadId: z.string(), turnId: z.string() });
const itemEventSchema = scopeSchema.extend({ item: CodexItemSchema });
const deltaSchema = scopeSchema.extend({ itemId: z.string(), delta: z.string() });
const turnEventSchema = z.object({ threadId: z.string(), turn: CodexTurnSchema });
const requestSchema = scopeSchema.extend({
	itemId: z.string(),
	reason: z.string().nullish(),
	command: z.string().nullish(),
	questions: z.array(ConversationQuestionSchema).optional(),
	availableDecisions: z.array(z.unknown()).nullish(),
	permissions: z
		.object({
			network: z.record(z.string(), z.unknown()).nullish(),
			fileSystem: z.record(z.string(), z.unknown()).nullish(),
		})
		.optional(),
});

export function applyCodexEvent(
	projection: ConversationProjection,
	event: CodexEnvelope,
	runtimeId: string,
) {
	const method = event.method;
	if (method === "turn/started" || method === "turn/completed") {
		const { turn } = turnEventSchema.parse(event.params);
		const previous = projection.turns.find((entry) => entry.id === turn.id);
		const items = new Map(previous?.items.map((item) => [item.id, item]));
		for (const item of turn.items) {
			items.set(item.id, item);
		}
		const next = { ...turn, items: [...items.values()] };
		const index = projection.turns.findIndex((entry) => entry.id === turn.id);
		if (index < 0) {
			projection.turns.push(next);
		} else {
			projection.turns[index] = next;
		}
		if (method === "turn/started") {
			projection.activeTurnId = turn.id;
			projection.error = null;
			projection.diff = "";
		} else {
			if (projection.activeTurnId === turn.id) {
				projection.activeTurnId = null;
			}
			projection.requests = projection.requests.filter((request) => request.turnId !== turn.id);
			projection.error = turn.error?.message ?? null;
		}
		return true;
	}
	if (method === "item/started" || method === "item/completed") {
		const { turnId, item } = itemEventSchema.parse(event.params);
		const turn = projection.turns.find((entry) => entry.id === turnId);
		if (!turn) {
			return false;
		}
		const index = turn.items.findIndex((entry) => entry.id === item.id);
		if (index < 0) {
			turn.items.push(item);
		} else {
			turn.items[index] = item;
		}
		return true;
	}
	if (
		method === "item/agentMessage/delta" ||
		method === "item/plan/delta" ||
		method === "item/commandExecution/outputDelta" ||
		method === "item/reasoning/summaryTextDelta" ||
		method === "item/reasoning/textDelta" ||
		method === "item/reasoning/summaryPartAdded"
	) {
		const schema = deltaSchema.extend({
			summaryIndex: z.number().int().nonnegative().optional(),
			contentIndex: z.number().int().nonnegative().optional(),
		});
		const params =
			method === "item/reasoning/summaryPartAdded"
				? schema
						.omit({ delta: true })
						.transform((value) => ({ ...value, delta: "" }))
						.parse(event.params)
				: schema.parse(event.params);
		const turn = projection.turns.find((entry) => entry.id === params.turnId);
		if (!turn) {
			return false;
		}
		const item = turn.items.find((entry) => entry.id === params.itemId);
		if (!item) {
			return false;
		}
		if (method === "item/commandExecution/outputDelta") {
			item.aggregatedOutput = (item.aggregatedOutput ?? "") + params.delta;
		} else if (
			method === "item/reasoning/summaryTextDelta" ||
			method === "item/reasoning/summaryPartAdded"
		) {
			const index = params.summaryIndex ?? 0;
			item.summary ??= [];
			while (item.summary.length <= index) {
				item.summary.push("");
			}
			item.summary[index] = (item.summary[index] ?? "") + params.delta;
		} else if (method === "item/reasoning/textDelta") {
			const index = params.contentIndex ?? 0;
			const content = (item.content ?? []).filter(
				(entry): entry is string => typeof entry === "string",
			);
			while (content.length <= index) {
				content.push("");
			}
			content[index] = (content[index] ?? "") + params.delta;
			item.content = content;
		} else {
			item.text = (item.text ?? "") + params.delta;
		}
		return true;
	}
	if (method === "turn/diff/updated") {
		const params = scopeSchema.extend({ diff: z.string() }).parse(event.params);
		if (
			params.turnId === projection.activeTurnId ||
			params.turnId === projection.turns.at(-1)?.id
		) {
			projection.diff = params.diff;
			return true;
		}
	}
	if (method === "serverRequest/resolved") {
		const { requestId } = z
			.object({ requestId: z.union([z.string(), z.number()]) })
			.parse(event.params);
		projection.requests = projection.requests.filter((request) => request.id !== requestId);
		return true;
	}
	if (method === "error") {
		projection.error = z
			.object({ error: z.object({ message: z.string() }) })
			.parse(event.params).error.message;
		return true;
	}
	if (event.id !== undefined && method) {
		if (
			![
				"item/commandExecution/requestApproval",
				"item/fileChange/requestApproval",
				"item/tool/requestUserInput",
				"item/permissions/requestApproval",
			].includes(method)
		) {
			return false;
		}
		const params = requestSchema.parse(event.params);
		const decisions = z
			.array(z.enum(["accept", "acceptForSession", "decline", "cancel"]))
			.parse(
				(params.availableDecisions ?? ["accept", "acceptForSession", "decline", "cancel"]).filter(
					(decision) => typeof decision === "string",
				),
			);
		const request: ConversationRequest = {
			id: event.id,
			runtimeId,
			method,
			turnId: params.turnId,
			itemId: params.itemId,
			reason: params.reason,
			command: params.command,
			questions: params.questions,
			decisions,
			...(params.permissions ? { details: JSON.stringify(params.permissions, null, 2) } : {}),
		};
		projection.requests = projection.requests.filter(
			(entry) => entry.id !== request.id || entry.runtimeId !== runtimeId,
		);
		projection.requests.push(request);
		return true;
	}
	return false;
}

export function permissionResponse(params: unknown, accept: boolean) {
	const { permissions } = requestSchema.parse(params);
	if (!permissions || !accept) {
		return { permissions: {}, scope: "turn" };
	}
	return {
		permissions: {
			...(permissions.network ? { network: permissions.network } : {}),
			...(permissions.fileSystem ? { fileSystem: permissions.fileSystem } : {}),
		},
		scope: "turn",
	};
}
