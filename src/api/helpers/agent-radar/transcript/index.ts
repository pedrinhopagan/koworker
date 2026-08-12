import type { AgentSessionEvent } from "@/lib/agent-session";
import { PubSub } from "../../../pubsub";
import { getRadarAgent } from "../state";
import { locateAgentTranscript, type AgentTranscript } from "./locate";
import { syncPaneTranscriptSource } from "./sync";
import { openTranscriptTail, type TranscriptTail } from "./tail";

// De quanto em quanto tempo o pane é reperguntado ao disco. É o que troca a conversa quando o mesmo
// pane começa outra sessão: o arquivo antigo para de crescer e ninguém avisa que existe um novo.
// Só roda enquanto alguém está lendo a conversa, então o intervalo curto custa pouco e é o que faz um
// `/clear` no terminal aparecer na tela em segundos, e não no minuto seguinte.
const RESOLVE_INTERVAL_MS = 2_000;

type PaneTranscript = {
	tail: TranscriptTail | null;
	readers: number;
	timer: ReturnType<typeof setInterval>;
	resolving: boolean;
	missing: boolean;
};

const panes = new Map<string, PaneTranscript>();

export type AgentRadarTranscriptEnvelope = {
	paneId: string;
	// `reset` marca a conversa inteira, não um acréscimo: o cliente joga fora o que tinha antes de
	// aplicar, porque os `seq` recomeçaram do zero num arquivo novo.
	events?: AgentSessionEvent[];
	reset?: boolean;
	source?: AgentTranscript;
	// O agent existe no radar mas não há transcript para ele: CLI sem arquivo de sessão, ou sessão
	// que ainda não escreveu a primeira linha.
	missing?: boolean;
	// O modelo que o CLI reportou por último no próprio transcript; ausente enquanto a sessão não
	// escreveu nenhuma resposta.
	model?: string;
};

function publish(envelope: AgentRadarTranscriptEnvelope) {
	return PubSub.publish("agentRadarTranscript", envelope.paneId, envelope);
}

async function openTail(paneId: string, source: AgentTranscript) {
	return await openTranscriptTail({
		sessionId: paneId,
		source,
		onEvents: (events, reset, model) =>
			void publish({ paneId, events, reset, source, ...(model ? { model } : {}) }),
		onError: (error) => console.error(`[Radar] Falha ao ler a conversa do pane ${paneId}:`, error),
	});
}

// O caminho da sessão pode aparecer depois (o agent reportou), sumir (o pane fechou) ou virar outro
// arquivo (sessão nova no mesmo pane). Uma resolução só serve para abrir; manter aberto é reresolver.
async function resolve(paneId: string) {
	const entry = panes.get(paneId);
	if (!entry || entry.resolving) {
		return;
	}
	entry.resolving = true;

	try {
		await syncPaneTranscriptSource(paneId);
		const agent = getRadarAgent(paneId);
		const source = agent ? await locateAgentTranscript(agent) : null;

		if (panes.get(paneId) !== entry) {
			return;
		}

		if (!source) {
			if (entry.tail) {
				entry.tail.close();
				entry.tail = null;
			}
			if (!entry.missing) {
				entry.missing = true;
				await publish({ paneId, missing: true, reset: true, events: [] });
			}

			return;
		}

		if (entry.tail?.source.cli === source.cli && entry.tail.source.path === source.path) {
			return;
		}

		entry.tail?.close();
		entry.tail = null;
		const tail = await openTail(paneId, source);
		if (panes.get(paneId) !== entry) {
			tail.close();

			return;
		}
		entry.tail = tail;
		entry.missing = false;
	} catch (error) {
		console.error(`[Radar] Falha ao resolver a conversa do pane ${paneId}:`, error);
	} finally {
		if (panes.get(paneId) === entry) {
			entry.resolving = false;
		}
	}
}

export async function refreshAgentRadarTranscript(paneId: string) {
	await resolve(paneId);
}

// A conversa que já está aberta em memória por causa de um leitor, ou nada. É o que deixa o preview
// da lista sair sem tocar o disco quando alguém está com o pane na tela.
export function openPaneTranscriptEvents(paneId: string) {
	return panes.get(paneId)?.tail?.events() ?? null;
}

export function openPaneTranscriptModel(paneId: string) {
	return panes.get(paneId)?.tail?.model() ?? null;
}

function release(paneId: string) {
	const entry = panes.get(paneId);
	if (!entry) {
		return;
	}

	entry.readers -= 1;
	if (entry.readers > 0) {
		return;
	}

	clearInterval(entry.timer);
	entry.tail?.close();
	panes.delete(paneId);
}

// A conversa de um pane, ao vivo. Assina antes de abrir o arquivo: um bloco publicado entre a
// leitura da cauda e a assinatura se perderia e a tela ficaria um turno atrás.
export async function* subscribeAgentRadarTranscript(paneId: string, signal?: AbortSignal) {
	const events = PubSub.subscribe("agentRadarTranscript", paneId, signal);
	const known = panes.get(paneId);

	if (known) {
		known.readers += 1;
		const model = known.tail?.model();
		yield {
			paneId,
			reset: true,
			events: known.tail?.events() ?? [],
			...(known.tail ? { source: known.tail.source } : { missing: true }),
			...(model ? { model } : {}),
		};
	} else {
		panes.set(paneId, {
			tail: null,
			readers: 1,
			resolving: false,
			missing: false,
			timer: setInterval(() => void resolve(paneId), RESOLVE_INTERVAL_MS).unref(),
		});
		await resolve(paneId);
	}

	try {
		yield* events;
	} finally {
		release(paneId);
	}
}
