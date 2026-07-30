import { z } from "zod";

import { askUser } from "./registry";

const PROTOCOL_VERSION = "2025-06-18";

const RequestSchema = z.object({
	jsonrpc: z.literal("2.0"),
	id: z.union([z.string(), z.number()]).optional(),
	method: z.string(),
	params: z.record(z.string(), z.unknown()).optional(),
});

const AskUserArgsSchema = z.object({
	question: z.string().trim().min(1),
	options: z
		.array(
			z.object({
				label: z.string().trim().min(1),
				description: z.string().trim().optional(),
			}),
		)
		.min(2)
		.max(4),
	multiSelect: z.boolean().default(false),
});

const ASK_USER_TOOL = {
	name: "ask_user",
	description:
		"Pergunta ao usuário e espera a resposta na interface do Kowork. Use quando precisar de uma decisão para seguir: escolha entre abordagens, confirmação de escopo, preferência de implementação. Ofereça de 2 a 4 opções distintas; o usuário também pode responder em texto livre.",
	inputSchema: {
		type: "object",
		properties: {
			question: {
				type: "string",
				description: "A pergunta completa, específica e terminando em ponto de interrogação.",
			},
			options: {
				type: "array",
				minItems: 2,
				maxItems: 4,
				description: "As escolhas oferecidas. Não inclua 'Outro': o texto livre já é oferecido.",
				items: {
					type: "object",
					properties: {
						label: { type: "string", description: "Rótulo curto da opção." },
						description: { type: "string", description: "O que essa escolha implica." },
					},
					required: ["label"],
				},
			},
			multiSelect: {
				type: "boolean",
				description: "Permite escolher mais de uma opção.",
			},
		},
		required: ["question", "options"],
	},
} as const;

function result(id: string | number | undefined, value: unknown) {
	return Response.json({ jsonrpc: "2.0", id, result: value });
}

function failure(id: string | number | undefined, code: number, message: string) {
	return Response.json({ jsonrpc: "2.0", id, error: { code, message } });
}

async function callTool(sessionId: string, params: Record<string, unknown> | undefined) {
	if (params?.name !== ASK_USER_TOOL.name) {
		return { isError: true, text: `Ferramenta desconhecida: ${String(params?.name)}` };
	}

	const args = AskUserArgsSchema.safeParse(params.arguments ?? {});
	if (!args.success) {
		return {
			isError: true,
			text: "A pergunta precisa de um texto e de 2 a 4 opções, cada uma com um rótulo.",
		};
	}

	const answer = await askUser({
		sessionId,
		question: args.data.question,
		options: args.data.options,
		multiSelect: args.data.multiSelect,
	});

	const chosen = [...answer.answers, ...(answer.freeText ? [answer.freeText] : [])];

	return {
		isError: false,
		text: chosen.length > 0 ? chosen.join("\n") : "O usuário não respondeu.",
	};
}

// Servidor MCP mínimo (streamable HTTP) com uma ferramenta só: perguntar ao usuário. Ele existe
// porque o `AskUserQuestion` nativo não é exposto no modo headless do CLI — sem isso o agente
// encerra o turno perguntando em texto, e a pergunta com opções não chega à rota.
export async function handleSessionMcp(request: Request, sessionId: string) {
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return failure(undefined, -32700, "Corpo JSON-RPC inválido");
	}

	const { id, method, params } = parsed.data;

	if (method === "initialize") {
		return result(id, {
			protocolVersion: PROTOCOL_VERSION,
			capabilities: { tools: { listChanged: false } },
			serverInfo: { name: "koworker", version: "1" },
		});
	}

	if (method.startsWith("notifications/")) {
		return new Response(null, { status: 202 });
	}

	if (method === "ping") {
		return result(id, {});
	}

	if (method === "tools/list") {
		return result(id, { tools: [ASK_USER_TOOL] });
	}

	if (method === "tools/call") {
		const outcome = await callTool(sessionId, params).catch((error) => ({
			isError: true,
			text: error instanceof Error ? error.message : "A pergunta não pôde ser entregue",
		}));

		return result(id, {
			content: [{ type: "text", text: outcome.text }],
			isError: outcome.isError,
		});
	}

	return failure(id, -32601, `Método não suportado: ${method}`);
}
