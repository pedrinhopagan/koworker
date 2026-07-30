import { z } from "zod";

export const AGENT_SESSION_STATUSES = ["live", "ended", "crashed"] as const;

export type AgentSessionStatus = (typeof AGENT_SESSION_STATUSES)[number];

export const AGENT_EVENT_KINDS = [
	"user",
	"assistant",
	"thinking",
	"tool_use",
	"tool_result",
	"permission",
	"question",
	"notice",
	"result",
] as const;

export type AgentEventKind = (typeof AGENT_EVENT_KINDS)[number];

const QuestionOptionSchema = z.object({
	label: z.string(),
	description: z.string().optional(),
});

// O payload de cada bloco da conversa, como vive na coluna JSON. Ler o banco é cruzar esta fronteira:
// o que não casar com o shape vira um bloco `notice` em vez de derrubar a leitura da sessão inteira.
export const AgentEventPayloadSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("user"), text: z.string(), images: z.number().optional() }),
	z.object({ kind: z.literal("assistant"), text: z.string() }),
	z.object({ kind: z.literal("thinking"), text: z.string() }),
	z.object({
		kind: z.literal("tool_use"),
		toolUseId: z.string().optional(),
		name: z.string(),
		label: z.string(),
		detail: z.string().optional(),
		status: z.enum(["running", "ok", "error"]),
	}),
	z.object({
		kind: z.literal("tool_result"),
		toolUseId: z.string(),
		ok: z.boolean(),
		detail: z.string().optional(),
	}),
	z.object({
		kind: z.literal("permission"),
		requestId: z.string(),
		toolName: z.string(),
		label: z.string(),
		detail: z.string().optional(),
		decision: z.enum(["allow", "deny"]).optional(),
		reason: z.string().optional(),
		expiredAt: z.number().optional(),
	}),
	z.object({
		kind: z.literal("question"),
		questionId: z.string(),
		question: z.string(),
		options: z.array(QuestionOptionSchema),
		multiSelect: z.boolean(),
		answers: z.array(z.string()).optional(),
		freeText: z.string().optional(),
	}),
	z.object({
		kind: z.literal("notice"),
		label: z.string(),
		detail: z.string().optional(),
		tone: z.enum(["info", "error"]),
	}),
	z.object({
		kind: z.literal("result"),
		status: z.enum(["done", "failed", "timeout", "cancelled"]),
		durationMs: z.number().optional(),
		costUsd: z.number().optional(),
		error: z.string().optional(),
	}),
]);

export type AgentEventPayload = z.infer<typeof AgentEventPayloadSchema>;

export type AgentEventPayloadOf<K extends AgentEventKind> = Extract<AgentEventPayload, { kind: K }>;

// O que um CLI emite, já traduzido para a conversa. Os dois tradutores (claude e codex) devolvem
// esta mesma lista e o registry aplica sem saber de qual CLI veio.
export type AgentSessionPatch =
	| { type: "append"; payload: AgentEventPayload }
	| { type: "settle"; toolUseId: string; ok: boolean; detail?: string }
	| {
			type: "permission";
			requestId: string;
			toolName: string;
			label: string;
			detail?: string;
			input: Record<string, unknown>;
	  }
	| {
			type: "result";
			status: "done" | "failed";
			durationMs?: number;
			costUsd?: number;
			error?: string;
	  }
	| { type: "cliSession"; cliSessionId: string };

export type AgentSessionEvent = {
	id: string;
	sessionId: string;
	runId?: string;
	seq: number;
	at: number;
	payload: AgentEventPayload;
};

export function parseAgentEventPayload(raw: string): AgentEventPayload {
	const parsed = AgentEventPayloadSchema.safeParse(
		((): unknown => {
			try {
				return JSON.parse(raw);
			} catch {
				return null;
			}
		})(),
	);
	if (parsed.success) {
		return parsed.data;
	}

	return { kind: "notice", label: "Bloco ilegível", tone: "error" };
}

// O acompanhamento ao vivo chega por partes e uma reconexão reentrega o que já se conhece: a
// identidade é o `seq`, então reaplicar o mesmo lote não duplica nada e um bloco que mudou de estado
// (ferramenta que terminou, permissão respondida) substitui a versão antiga.
export function mergeAgentSessionEvents(
	current: AgentSessionEvent[],
	incoming: AgentSessionEvent[],
) {
	if (incoming.length === 0) {
		return current;
	}

	const bySeq = new Map(current.map((event) => [event.seq, event]));
	for (const event of incoming) {
		bySeq.set(event.seq, event);
	}

	return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

export function isSessionLive(status: AgentSessionStatus) {
	return status === "live";
}

// A sessão espera o usuário quando o último bloco interativo ainda não tem resposta. É isso que a
// rota usa para travar o composer e destacar o pedido, e o que decide o push de "precisa de você".
export function pendingInteraction(events: AgentSessionEvent[]) {
	for (const event of events.toReversed()) {
		if (
			event.payload.kind === "permission" &&
			!event.payload.decision &&
			!event.payload.expiredAt
		) {
			return { kind: "permission" as const, event, payload: event.payload };
		}
		if (event.payload.kind === "question" && !event.payload.answers) {
			return { kind: "question" as const, event, payload: event.payload };
		}
	}

	return null;
}
