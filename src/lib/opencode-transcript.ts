import { z } from "zod";

import type { TranscriptPatch } from "@/lib/agent-transcript";
import { trim } from "@/lib/agent-stream";

// O opencode não guarda a conversa em arquivo: guarda em SQLite
// (~/.local/share/opencode/opencode.db), nas tabelas `message` e `part`. Uma parte nasce, cresce
// enquanto o modelo escreve e congela quando o passo termina — então a tradução não é linha a linha
// como no claude/codex, e sim estado que acompanha cada parte até ela valer um bloco.

const DETAIL_MAX_CHARS = 400;

const PartDataSchema = z.object({
	type: z.string(),
	synthetic: z.boolean().optional(),
	text: z.string().optional(),
	time: z.object({ end: z.number().optional() }).optional(),
	tool: z.string().optional(),
	callID: z.string().optional(),
	state: z
		.object({
			status: z.string().optional(),
			input: z.record(z.string(), z.unknown()).optional(),
			output: z.unknown().optional(),
		})
		.optional(),
});

export type OpencodePartRow = {
	id: string;
	messageId: string;
	role: string;
	data: unknown;
};

// Os rótulos seguem o vocabulário dos outros tradutores: quem desenha o passo lê o mesmo texto que
// aparece na tela, e os ícones casam pela chave do rótulo.
const TOOL_LABELS: Record<string, string> = {
	bash: "Terminal",
	read: "Ler arquivo",
	edit: "Editar arquivo",
	write: "Escrever arquivo",
	patch: "Alterar arquivos",
	grep: "Buscar no código",
	glob: "Listar arquivos",
	list: "Listar arquivos",
	webfetch: "Abrir página",
	websearch: "Pesquisar na web",
	todowrite: "Atualizar plano",
	todoread: "Atualizar plano",
	task: "Subagente",
	skill: "Skill",
};

const DETAIL_KEYS = [
	"command",
	"filePath",
	"file_path",
	"path",
	"pattern",
	"url",
	"query",
	"description",
	"name",
	"skill",
];

function detailOf(input: Record<string, unknown> | undefined) {
	const value = input
		? DETAIL_KEYS.map((key) => input[key]).find(
				(entry) => typeof entry === "string" && entry.trim(),
			)
		: undefined;

	return typeof value === "string" ? value : undefined;
}

function outputText(output: unknown) {
	return typeof output === "string" ? output : "";
}

export function createOpencodeTranscriptTranslator() {
	let emittedParts = new Set<string>();
	let settledTools = new Set<string>();
	let lastModel: string | null = null;

	function translate(rows: OpencodePartRow[]): TranscriptPatch[] {
		const patches: TranscriptPatch[] = [];

		// Uma parte vale bloco quando terminou: ou ela mesma diz (`time.end`), ou o passo em que ela
		// nasceu já fechou (`step-finish` depois dela na mesma mensagem). Sem isso, texto que ainda
		// está sendo escrito congelaria na tela com o primeiro pedaço.
		const stepClosedAfter = new Map<string, boolean>();
		let closed = false;
		let currentMessage: string | null = null;
		for (let index = rows.length - 1; index >= 0; index -= 1) {
			const row = rows[index];
			if (!row) {
				continue;
			}

			if (row.messageId !== currentMessage) {
				currentMessage = row.messageId;
				closed = false;
			}

			stepClosedAfter.set(row.id, closed);
			if (parsedType(row) === "step-finish") {
				closed = true;
			}
		}

		for (const row of rows) {
			const parsed = PartDataSchema.safeParse(row.data);
			if (!parsed.success) {
				continue;
			}

			const part = parsed.data;

			if (part.type === "text" && part.text?.trim()) {
				// Parte injetada pelo próprio opencode (contexto, lembrete) não é fala de ninguém.
				if (part.synthetic || emittedParts.has(row.id)) {
					continue;
				}

				const frozen =
					row.role !== "assistant" || part.time?.end !== undefined || stepClosedAfter.get(row.id);
				if (!frozen) {
					continue;
				}

				emittedParts.add(row.id);
				patches.push({
					type: "append",
					payload:
						row.role === "user"
							? { kind: "user", text: part.text }
							: { kind: "assistant", text: part.text },
				});

				continue;
			}

			if (part.type === "reasoning" && part.text?.trim()) {
				if (emittedParts.has(row.id)) {
					continue;
				}
				if (part.time?.end === undefined && !stepClosedAfter.get(row.id)) {
					continue;
				}

				emittedParts.add(row.id);
				patches.push({ type: "append", payload: { kind: "thinking", text: part.text } });

				continue;
			}

			if (part.type === "tool" && part.tool && part.callID) {
				const status = part.state?.status;
				const label = TOOL_LABELS[part.tool] ?? part.tool;
				const detail = trim(detailOf(part.state?.input), DETAIL_MAX_CHARS);

				if (!emittedParts.has(row.id)) {
					emittedParts.add(row.id);
					patches.push({
						type: "append",
						payload: {
							kind: "tool_use",
							toolUseId: part.callID,
							name: part.tool,
							label,
							status: "running",
							...(detail ? { detail } : {}),
						},
					});
				}

				if (settledTools.has(part.callID)) {
					continue;
				}

				if (status === "completed" || status === "error") {
					settledTools.add(part.callID);
					const failed = status === "error";
					const failureDetail = failed
						? trim(outputText(part.state?.output), DETAIL_MAX_CHARS)
						: undefined;

					patches.push({
						type: "settle",
						toolUseId: part.callID,
						ok: !failed,
						...(failureDetail ? { detail: failureDetail } : {}),
					});
				}

				continue;
			}
		}

		return patches;
	}

	return {
		translate,

		observeModel(modelId: string | null | undefined) {
			if (modelId?.trim()) {
				lastModel = modelId.trim();
			}
		},

		model: () => lastModel,

		reset() {
			emittedParts = new Set();
			settledTools = new Set();
			lastModel = null;
		},
	};
}

function parsedType(row: OpencodePartRow) {
	const parsed = PartDataSchema.safeParse(row.data);

	return parsed.success ? parsed.data.type : null;
}
