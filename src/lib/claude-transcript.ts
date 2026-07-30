import { z } from "zod";

import type { TranscriptPatch } from "@/lib/agent-transcript";
import { translateClaudeLine } from "@/lib/claude-session-stream";

// O arquivo que o `claude` grava em `~/.claude/projects` é a mesma conversa do stdout mais o que o
// CLI escreve só para si: injeção de contexto, anexo de hook, fila de prompt e blocos de subagente.
const TranscriptLineSchema = z.object({
	type: z.string().optional(),
	isSidechain: z.boolean().optional(),
	isMeta: z.boolean().optional(),
	message: z.object({ content: z.unknown().optional() }).optional(),
});

const SYSTEM_REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g;
const COMMAND_NAME = /<command-name>([\s\S]*?)<\/command-name>/;
const COMMAND_ARGS = /<command-args>([\s\S]*?)<\/command-args>/;

// O que o usuário digitou chega embrulhado: lembrete de sistema que ele nunca viu e, quando é uma
// skill, a marcação do comando. Na tela do celular tem que aparecer o que ele leria no terminal.
function userText(raw: string) {
	const clean = raw.replaceAll(SYSTEM_REMINDER, "").trim();
	const args = COMMAND_ARGS.exec(clean);

	if (!args) {
		return clean;
	}

	return [COMMAND_NAME.exec(clean)?.[1]?.trim(), args[1]?.trim()].filter(Boolean).join(" ");
}

export function translateClaudeTranscriptLine(raw: unknown): TranscriptPatch[] {
	const parsed = TranscriptLineSchema.safeParse(raw);
	if (!parsed.success) {
		return [];
	}

	const line = parsed.data;
	if (line.isSidechain || line.isMeta) {
		return [];
	}

	// A fala do usuário é sempre texto puro; o que chega em blocos é resultado de ferramenta ou
	// contexto que o CLI injetou no lugar dele.
	if (line.type === "user" && typeof line.message?.content === "string") {
		const text = userText(line.message.content);

		return text ? [{ type: "append", payload: { kind: "user", text } }] : [];
	}

	return translateClaudeLine(raw).filter(
		(patch): patch is TranscriptPatch => patch.type !== "permission" && patch.type !== "cliSession",
	);
}
