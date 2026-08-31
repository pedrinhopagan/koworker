import { Database } from "bun:sqlite";

import type { AgentTranscript } from "@/api/schemas/agent-radar-transcript";
import { recentTranscriptText } from "@/lib/agent-timeline";
import { createTranscriptMirror, createTranscriptParser } from "@/lib/agent-transcript";
import { claudeTranscriptModel, translateClaudeTranscriptLine } from "@/lib/claude-transcript";
import { codexTranscriptModel, translateCodexTranscriptLine } from "@/lib/codex-transcript";
import { createOpencodeTranscriptTranslator } from "@/lib/opencode-transcript";
import { listRadarAgents } from "../state";
import { openPaneTranscriptEvents, openPaneTranscriptModel } from "./index";
import { locateAgentTranscript } from "./locate";

// A última fala de cada conversa, que é tudo o que a lista de agents mostra. Ler a cauda basta: a
// frase mais recente está no fim do arquivo, e reler um pedaço do fim é barato perto de manter uma
// conversa inteira aberta por cartão da lista.
const TAIL_BYTES = 256_000;
const CACHE_LIMIT = 60;

type Preview = { text: string | null; model: string | null };

// Chaveado pelo caminho e revalidado pelo tamanho: transcript é só acréscimo, então arquivo do mesmo
// tamanho tem a mesma última fala.
const cache = new Map<string, { size: number; preview: Preview }>();

function remember(path: string, size: number, preview: Preview) {
	cache.delete(path);
	cache.set(path, { size, preview });

	if (cache.size > CACHE_LIMIT) {
		const oldest = cache.keys().next().value;
		if (oldest) {
			cache.delete(oldest);
		}
	}
}

async function readPreview(source: AgentTranscript, size: number): Promise<Preview> {
	const from = Math.max(0, size - TAIL_BYTES);
	const raw = await Bun.file(source.path).slice(from, size).text();
	// A cauda começa no meio de uma linha quando o arquivo passa do pedaço lido: a primeira linha sai
	// fora porque não é JSON inteiro.
	const chunk = from === 0 ? raw : raw.slice(raw.indexOf("\n") + 1);

	const mirror = createTranscriptMirror("preview");
	const translate =
		source.cli === "claude" ? translateClaudeTranscriptLine : translateCodexTranscriptLine;
	const extractModel = source.cli === "claude" ? claudeTranscriptModel : codexTranscriptModel;
	let model: string | null = null;
	const parser = createTranscriptParser((line) => {
		model = extractModel(line) ?? model;

		return translate(line);
	});
	mirror.apply(parser.push(`${chunk}\n`));

	return { text: recentTranscriptText(mirror.list()), model };
}

// No opencode a conversa não é um arquivo que cresce: é uma sessão no banco. O "tamanho" que valida o
// cache é a última mutação da sessão, e a cauda são as últimas partes gravadas.
const OPENCODE_PREVIEW_PARTS = 60;

type OpencodePreviewRow = {
	id: string;
	message_id: string;
	part_data: string;
	model_id: string | null;
	role: string;
};

function readOpencodePreview(source: AgentTranscript): Preview {
	const sessionId = source.sessionId;
	if (!sessionId) {
		return { text: null, model: null };
	}

	const db = new Database(source.path, { readonly: true });
	try {
		const rows = (
			db
				.query(
					`SELECT p.id, p.message_id, p.data AS part_data,
					        json_extract(m.data, '$.modelID') AS model_id,
					        json_extract(m.data, '$.role') AS role
					 FROM part p
					 JOIN message m ON m.id = p.message_id
					 WHERE p.session_id = ?
					 ORDER BY p.rowid DESC
					 LIMIT ${OPENCODE_PREVIEW_PARTS}`,
				)
				.all(sessionId) as OpencodePreviewRow[]
		).toReversed();

		const mirror = createTranscriptMirror("preview");
		const translator = createOpencodeTranscriptTranslator();
		for (const row of rows) {
			translator.observeModel(row.model_id);
		}
		mirror.apply(
			translator.translate(
				rows.map((row) => ({
					id: row.id,
					messageId: row.message_id,
					role: row.role ?? "",
					data: JSON.parse(row.part_data),
				})),
			),
		);

		return { text: recentTranscriptText(mirror.list()), model: translator.model() };
	} finally {
		db.close();
	}
}

function opencodeStamp(source: AgentTranscript): number | null {
	if (!source.sessionId) {
		return null;
	}

	const db = new Database(source.path, { readonly: true });
	try {
		return (
			db
				.query("SELECT MAX(time_updated) AS stamp FROM part WHERE session_id = ?")
				.get(source.sessionId) as { stamp: number | null }
		).stamp;
	} catch {
		return null;
	} finally {
		db.close();
	}
}

async function previewOf(paneId: string, source: AgentTranscript): Promise<Preview> {
	// Pane com alguém lendo a conversa já tem o histórico em memória: o preview sai dali sem disco.
	const live = openPaneTranscriptEvents(paneId);
	if (live) {
		return { text: recentTranscriptText(live), model: openPaneTranscriptModel(paneId) };
	}

	if (source.cli === "opencode") {
		const stamp = opencodeStamp(source);
		const cacheKey = `${source.path}:${source.sessionId}`;
		const cached = cache.get(cacheKey);
		if (stamp !== null && cached?.size === stamp) {
			return cached.preview;
		}

		let preview: Preview;
		try {
			preview = readOpencodePreview(source);
		} catch {
			preview = { text: null, model: null };
		}
		if (stamp !== null) {
			remember(cacheKey, stamp, preview);
		}

		return preview;
	}

	const size = Bun.file(source.path).size;
	const cached = cache.get(source.path);
	if (cached?.size === size) {
		return cached.preview;
	}

	const preview = await readPreview(source, size).catch(
		(): Preview => ({ text: null, model: null }),
	);
	remember(source.path, size, preview);

	return preview;
}

// Uma leitura só para a lista inteira. A alternativa era uma assinatura de conversa por cartão, que
// baixava o histórico completo de cada agent aberto para exibir uma linha de texto.
export async function agentRadarTranscriptPreviews() {
	return await Promise.all(
		listRadarAgents().map(async (agent) => {
			const source = await locateAgentTranscript(agent);
			const preview = source ? await previewOf(agent.paneId, source) : { text: null, model: null };

			return { paneId: agent.paneId, text: preview.text, model: preview.model };
		}),
	);
}
