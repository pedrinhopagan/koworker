import { recentTranscriptText } from "@/lib/agent-timeline";
import { createTranscriptMirror, createTranscriptParser } from "@/lib/agent-transcript";
import { claudeTranscriptModel, translateClaudeTranscriptLine } from "@/lib/claude-transcript";
import { codexTranscriptModel, translateCodexTranscriptLine } from "@/lib/codex-transcript";
import { listRadarAgents } from "../state";
import { openPaneTranscriptEvents, openPaneTranscriptModel } from "./index";
import { locateAgentTranscript, type AgentTranscript } from "./locate";

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

async function previewOf(paneId: string, source: AgentTranscript): Promise<Preview> {
	// Pane com alguém lendo a conversa já tem o histórico em memória: o preview sai dali sem disco.
	const live = openPaneTranscriptEvents(paneId);
	if (live) {
		return { text: recentTranscriptText(live), model: openPaneTranscriptModel(paneId) };
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
