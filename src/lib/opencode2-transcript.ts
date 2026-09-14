import { z } from "zod";

import { trim } from "@/lib/agent-stream";
import type { TranscriptPatch } from "@/lib/agent-transcript";
import { DETAIL_MAX_CHARS, detailOf, TOOL_LABELS } from "@/lib/opencode-transcript";

// O opencode 2 guarda a conversa no mesmo banco do 1, em outras tabelas: `session_v2` e
// `session_message`. A diferença que importa aqui é que ele não parte a mensagem em linhas: cada
// mensagem é uma linha só, reescrita no lugar enquanto o modelo responde, com o conteúdo inteiro
// dentro dela. O que decide se um bloco já vale é `time.completed` da mensagem, não o estado de cada
// pedaço.

export type Opencode2MessageRow = {
	id: string;
	type: string;
	data: unknown;
};

const ToolStateSchema = z.object({
	status: z.string().optional(),
	input: z.record(z.string(), z.unknown()).optional(),
	error: z.object({ message: z.string().optional() }).optional(),
});

const ContentPartSchema = z.object({
	type: z.string(),
	text: z.string().optional(),
	id: z.string().optional(),
	name: z.string().optional(),
	synthetic: z.boolean().optional(),
	state: ToolStateSchema.optional(),
});

const UserMessageSchema = z.object({
	text: z.string().optional(),
});

const AssistantMessageSchema = z.object({
	time: z.object({ completed: z.number().optional() }).optional(),
	model: z.object({ id: z.string().optional() }).optional(),
	content: z.array(ContentPartSchema).optional(),
});

export function createOpencode2TranscriptTranslator() {
	let emitted = new Set<string>();
	let settledTools = new Set<string>();
	let lastModel: string | null = null;

	function translateUser(row: Opencode2MessageRow, patches: TranscriptPatch[]) {
		if (emitted.has(row.id)) {
			return;
		}

		const text = UserMessageSchema.safeParse(row.data).data?.text;
		if (!text?.trim()) {
			return;
		}

		emitted.add(row.id);
		patches.push({ type: "append", payload: { kind: "user", text } });
	}

	function translateAssistant(row: Opencode2MessageRow, patches: TranscriptPatch[]) {
		const parsed = AssistantMessageSchema.safeParse(row.data);
		if (!parsed.success) {
			return;
		}

		const message = parsed.data;
		if (message.model?.id?.trim()) {
			lastModel = message.model.id.trim();
		}

		// A mensagem é reescrita inteira a cada pedaço que chega: só depois de `completed` o texto
		// parou de crescer e pode virar bloco. Ferramenta é exceção — ela já nasce com o estado
		// dela e é o que mostra que o agente está fazendo algo agora.
		const complete = message.time?.completed !== undefined;

		for (const [index, part] of (message.content ?? []).entries()) {
			const key = `${row.id}:${index}`;

			if (part.type === "tool") {
				translateTool(part, key, patches);
				continue;
			}

			if (!complete || part.synthetic || emitted.has(key) || !part.text?.trim()) {
				continue;
			}

			emitted.add(key);
			patches.push({
				type: "append",
				payload:
					part.type === "reasoning"
						? { kind: "thinking", text: part.text }
						: { kind: "assistant", text: part.text },
			});
		}
	}

	function translateTool(
		part: z.infer<typeof ContentPartSchema>,
		key: string,
		patches: TranscriptPatch[],
	) {
		const callId = part.id;
		const name = part.name;
		if (!callId || !name) {
			return;
		}

		if (!emitted.has(key)) {
			emitted.add(key);
			const detail = trim(detailOf(part.state?.input), DETAIL_MAX_CHARS);
			patches.push({
				type: "append",
				payload: {
					kind: "tool_use",
					toolUseId: callId,
					name,
					label: TOOL_LABELS[name] ?? name,
					status: "running",
					...(detail ? { detail } : {}),
				},
			});
		}

		const status = part.state?.status;
		if (settledTools.has(callId) || (status !== "completed" && status !== "error")) {
			return;
		}

		settledTools.add(callId);
		const failureDetail =
			status === "error" ? trim(part.state?.error?.message ?? "", DETAIL_MAX_CHARS) : undefined;

		patches.push({
			type: "settle",
			toolUseId: callId,
			ok: status !== "error",
			...(failureDetail ? { detail: failureDetail } : {}),
		});
	}

	return {
		translate(rows: Opencode2MessageRow[]): TranscriptPatch[] {
			const patches: TranscriptPatch[] = [];

			for (const row of rows) {
				if (row.type === "user") {
					translateUser(row, patches);
				} else if (row.type === "assistant") {
					translateAssistant(row, patches);
				}
			}

			return patches;
		},

		model: () => lastModel,

		reset() {
			emitted = new Set();
			settledTools = new Set();
			lastModel = null;
		},
	};
}
