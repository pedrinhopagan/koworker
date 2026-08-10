import { recentTranscriptText } from "@/lib/agent-timeline";
import { createTranscriptMirror, createTranscriptParser } from "@/lib/agent-transcript";
import { translateClaudeTranscriptLine } from "@/lib/claude-transcript";
import { translateCodexTranscriptLine } from "@/lib/codex-transcript";
import { listRadarAgents } from "../state";
import { openPaneTranscriptEvents } from "./index";
import { locateAgentTranscript, type AgentTranscript } from "./locate";

// A última fala de cada conversa, que é tudo o que a lista de agents mostra. Ler a cauda basta: a
// frase mais recente está no fim do arquivo, e reler um pedaço do fim é barato perto de manter uma
// conversa inteira aberta por cartão da lista.
const TAIL_BYTES = 256_000;
const CACHE_LIMIT = 60;

// Chaveado pelo caminho e revalidado pelo tamanho: transcript é só acréscimo, então arquivo do mesmo
// tamanho tem a mesma última fala.
const cache = new Map<string, { size: number; text: string | null }>();

function remember(path: string, size: number, text: string | null) {
	cache.delete(path);
	cache.set(path, { size, text });

	if (cache.size > CACHE_LIMIT) {
		const oldest = cache.keys().next().value;
		if (oldest) {
			cache.delete(oldest);
		}
	}
}

async function readPreview(source: AgentTranscript, size: number) {
	const from = Math.max(0, size - TAIL_BYTES);
	const raw = await Bun.file(source.path).slice(from, size).text();
	// A cauda começa no meio de uma linha quando o arquivo passa do pedaço lido: a primeira linha sai
	// fora porque não é JSON inteiro.
	const chunk = from === 0 ? raw : raw.slice(raw.indexOf("\n") + 1);

	const mirror = createTranscriptMirror("preview");
	const parser = createTranscriptParser(
		source.cli === "claude" ? translateClaudeTranscriptLine : translateCodexTranscriptLine,
	);
	mirror.apply(parser.push(`${chunk}\n`));

	return recentTranscriptText(mirror.list());
}

async function previewOf(paneId: string, source: AgentTranscript) {
	// Pane com alguém lendo a conversa já tem o histórico em memória: o preview sai dali sem disco.
	const live = openPaneTranscriptEvents(paneId);
	if (live) {
		return recentTranscriptText(live);
	}

	const size = Bun.file(source.path).size;
	const cached = cache.get(source.path);
	if (cached?.size === size) {
		return cached.text;
	}

	const text = await readPreview(source, size).catch(() => null);
	remember(source.path, size, text);

	return text;
}

// Uma leitura só para a lista inteira. A alternativa era uma assinatura de conversa por cartão, que
// baixava o histórico completo de cada agent aberto para exibir uma linha de texto.
export async function agentRadarTranscriptPreviews() {
	return await Promise.all(
		listRadarAgents().map(async (agent) => {
			const source = locateAgentTranscript(agent);

			return {
				paneId: agent.paneId,
				text: source ? await previewOf(agent.paneId, source) : null,
			};
		}),
	);
}
