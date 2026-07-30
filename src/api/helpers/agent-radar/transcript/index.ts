import type { AgentSessionEvent } from "@/lib/agent-session";
import { PubSub } from "../../../pubsub";
import { getRadarAgent } from "../state";
import { locateAgentTranscript, type AgentTranscript } from "./locate";
import { openTranscriptTail, type TranscriptTail } from "./tail";

// De quanto em quanto tempo o pane é reperguntado ao disco. É o que troca a conversa quando o mesmo
// pane começa outra sessão: o arquivo antigo para de crescer e ninguém avisa que existe um novo.
const RESOLVE_INTERVAL_MS = 15_000;

type PaneTranscript = {
	tail: TranscriptTail | null;
	readers: number;
	timer: ReturnType<typeof setInterval>;
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
};

function publish(envelope: AgentRadarTranscriptEnvelope) {
	return PubSub.publish("agentRadarTranscript", envelope.paneId, envelope);
}

async function openTail(paneId: string, source: AgentTranscript) {
	return await openTranscriptTail({
		sessionId: paneId,
		source,
		onEvents: (events, reset) => void publish({ paneId, events, reset, source }),
		onError: (error) => console.error(`[Radar] Falha ao ler a conversa do pane ${paneId}:`, error),
	});
}

// O caminho da sessão pode aparecer depois (o agent reportou), sumir (o pane fechou) ou virar outro
// arquivo (sessão nova no mesmo pane). Uma resolução só serve para abrir; manter aberto é reresolver.
async function resolve(paneId: string) {
	const entry = panes.get(paneId);
	if (!entry) {
		return;
	}

	const agent = getRadarAgent(paneId);
	const source = agent ? await locateAgentTranscript(agent) : null;

	if (!panes.has(paneId)) {
		return;
	}

	if (!source) {
		if (entry.tail) {
			entry.tail.close();
			entry.tail = null;
		}
		await publish({ paneId, missing: true });

		return;
	}

	if (entry.tail?.source.path === source.path) {
		return;
	}

	entry.tail?.close();
	entry.tail = await openTail(paneId, source);
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
		yield {
			paneId,
			reset: true,
			events: known.tail?.events() ?? [],
			...(known.tail ? { source: known.tail.source } : { missing: true }),
		};
	} else {
		panes.set(paneId, {
			tail: null,
			readers: 1,
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
