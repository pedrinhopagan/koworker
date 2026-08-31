import { PubSub } from "@/api/pubsub";
import {
	kwTerminalPaneRead,
	kwTerminalPaneRecent,
	kwTerminalPaneSize,
} from "@/api/helpers/terminal/kw-terminal";
import { paneTerminalControls } from "./pane-control";

// O daemon do kw-terminal não empurra saída de pane: `events.subscribe` só conhece
// `pane.output_matched`, `pane.agent_status_changed` e `pane.scroll_changed`. Espelhar é ler
// `pane.read` em laço; a leitura custa menos de 1ms no socket local, então o intervalo é o que
// define a fluidez da tela — 500ms davam o vídeo travado que a visão tinha antes.
// ponytail: polling a 40ms; trocar por assinatura quando o daemon ganhar `pane.output_changed`.
const SCREEN_POLL_MS = 40;
// O tamanho do pane só muda em split/resize do cliente TUI: ler o layout junto de toda tela dobrava
// as conexões com o daemon sem trazer nada novo.
const SIZE_REFRESH_MS = 1000;
const SCREEN_ERROR_BACKOFF_MS = 1000;
// Teto do scroll no histórico, em linhas a partir do fim. O buffer do pane vale megabytes; sem teto
// um wheel solto pedia ao daemon uma leitura gigante. O clamp do topo é pela janela, não por aqui.
const MAX_SCROLL_LINES = 2000;
// Sonda de histórico para o primeiro wheel pra cima no vivo: quantas linhas ler além da viewport
// para decidir se existe histórico de terminal (TUI em alt screen não tem nada) e por quanto tempo
// o resultado vale — saída nova do agent cria histórico que a sonda antiga não viu.
const WHEEL_PROBE_TTL_MS = 4000;

type ScreenReader = {
	readers: number;
	timer: ReturnType<typeof setTimeout> | null;
	stopped: boolean;
	last: string;
	cols: number;
	rows: number;
	sizeReadAt: number;
	failing: boolean;
	offset: number;
	maxOffset: number;
	probedAt: number;
};

const readers = new Map<string, ScreenReader>();

// A janela do histórico: `rows` linhas terminando `offset` linhas antes do fim da leitura. Sem
// história suficiente, o offset clamp no topo e volta ajustado — o próximo pedido já nasce certo.
export function recentWindow(
	lines: string[],
	rows: number,
	offset: number,
): { ansi: string; offset: number } {
	const clamped = Math.min(offset, Math.max(0, lines.length - rows));
	const start = Math.max(0, lines.length - clamped - rows);

	return { ansi: lines.slice(start, lines.length - clamped).join("\n"), offset: clamped };
}

function schedule(paneId: string, reader: ScreenReader, delay: number) {
	if (reader.stopped) {
		return;
	}

	if (reader.timer) {
		clearTimeout(reader.timer);
	}

	reader.timer = setTimeout(() => void tick(paneId, reader), delay);
	reader.timer.unref();
}

async function tick(paneId: string, reader: ScreenReader) {
	if (reader.stopped) {
		return;
	}

	try {
		// Com controller vivo, o grid publicado é o que ele pediu para o runtime: o ANSI lido é o
		// grid do PTY, e o `pane.layout` continua com o retângulo da TUI — publicar o layout
		// recortava a largura do espelho no tamanho da janela do kw-terminal.
		const control = paneTerminalControls.grid(paneId);
		if (!control && Date.now() - reader.sizeReadAt >= SIZE_REFRESH_MS) {
			const size = await kwTerminalPaneSize(paneId);
			reader.sizeReadAt = Date.now();
			reader.cols = size.cols;
			reader.rows = size.rows;
		}

		const cols = control?.cols ?? reader.cols;
		const rows = control?.rows ?? reader.rows;

		// No vivo a leitura é a viewport (`visible`); scrollado, a cauda do buffer (`recent`) com a
		// janela do espelho terminando `offset` linhas antes do fim — o wheel do cliente rola o
		// histórico real do pane, não o conteúdo que o agent tem na tela.
		let read: { ansi: string; revision: number };
		if (reader.offset > 0) {
			const recent = await kwTerminalPaneRecent(paneId, rows + reader.offset);
			const window = recentWindow(recent.ansi.split(/\r?\n/), rows, reader.offset);
			reader.offset = window.offset;
			read = { ansi: window.ansi, revision: recent.revision };
		} else {
			read = await kwTerminalPaneRead(paneId);
		}

		reader.failing = false;
		const signature = `${cols}x${rows}@${reader.offset}\n${read.ansi}`;
		if (signature !== reader.last) {
			reader.last = signature;
			await PubSub.publish("agentTerminalScreen", paneId, {
				paneId,
				ansi: read.ansi,
				revision: read.revision,
				cols,
				rows,
				offset: reader.offset,
			});
		}
	} catch (error) {
		// Pane fechado ou daemon fora do ar: um log por sequência de falha, senão o laço enche o
		// terminal do servidor 25 vezes por segundo.
		if (!reader.failing) {
			reader.failing = true;
			console.error(`[Radar] Falha ao espelhar a tela do pane ${paneId}:`, error);
		}
		schedule(paneId, reader, SCREEN_ERROR_BACKOFF_MS);

		return;
	}

	schedule(paneId, reader, SCREEN_POLL_MS);
}

export async function* subscribeAgentTerminalScreen(paneId: string, signal?: AbortSignal) {
	const events = PubSub.subscribe("agentTerminalScreen", paneId, signal);
	const known = readers.get(paneId);
	const reader =
		known ??
		({
			readers: 0,
			timer: null,
			stopped: false,
			last: "",
			cols: 80,
			rows: 24,
			sizeReadAt: 0,
			failing: false,
			offset: 0,
			maxOffset: 0,
			probedAt: 0,
		} satisfies ScreenReader);
	reader.readers += 1;
	readers.set(paneId, reader);

	try {
		if (!known) {
			void tick(paneId, reader);
		}

		const size = paneTerminalControls.grid(paneId) ?? (await kwTerminalPaneSize(paneId));
		const read = await kwTerminalPaneRead(paneId);
		yield { paneId, ansi: read.ansi, revision: read.revision, offset: reader.offset, ...size };
		yield* events;
	} finally {
		reader.readers -= 1;
		if (reader.readers === 0) {
			reader.stopped = true;
			if (reader.timer) {
				clearTimeout(reader.timer);
			}
			readers.delete(paneId);
			paneTerminalControls.release(paneId);
		}
	}
}

export function hasScreenReaders(paneId: string): boolean {
	return (readers.get(paneId)?.readers ?? 0) > 0;
}

// O wheel do espelho tem dois destinos. Com histórico de terminal disponível, vira delta de linhas
// na ponte (offset). Sem — pane de TUI em alt screen não tem scrollback no daemon — o gesto é
// encaminhado ao agent como seta: é o transcript dele que existe "em cima", não linhas de terminal.
export function decideWheel(
	state: { offset: number; maxOffset: number },
	delta: number,
): "history" | "forward" {
	if (state.offset > 0) {
		return "history";
	}

	if (delta < 0) {
		return "forward";
	}

	return state.maxOffset > 0 ? "history" : "forward";
}

// Rola o histórico do pane pela ponte ou reporta que o gesto pertence ao TUI. Só vale com a visão
// aberta; um tick imediato faz o scroll colar no dedo em vez de esperar o laço de 40ms.
export async function scrollAgentTerminalScreen(
	paneId: string,
	delta: number,
): Promise<"history" | "forward" | "inactive"> {
	const reader = readers.get(paneId);
	if (!reader || reader.stopped) {
		return "inactive";
	}

	// No vivo, um pedido pra cima precisa saber se existe história antes de decidir o destino. A
	// sonda lê uma cauda curta e guarda o resultado; falha do daemon mantém a decisão anterior.
	const rows = reader.rows || 24;
	if (reader.offset === 0 && delta > 0 && Date.now() - reader.probedAt >= WHEEL_PROBE_TTL_MS) {
		reader.probedAt = Date.now();
		try {
			const probe = await kwTerminalPaneRecent(paneId, rows * 4);
			reader.maxOffset = Math.max(0, probe.ansi.split(/\r?\n/).length - rows);
		} catch {
			// Pane fechado ou daemon fora do ar: trata como sem histórico até a próxima sonda.
			reader.maxOffset = 0;
		}
	}

	if (decideWheel(reader, delta) === "forward") {
		return "forward";
	}

	const next = Math.min(Math.max(reader.offset + delta, 0), MAX_SCROLL_LINES);
	if (next === reader.offset) {
		return "history";
	}

	reader.offset = next;
	schedule(paneId, reader, 0);
	return "history";
}
