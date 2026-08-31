import { History } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAgentRadar } from "@/hooks/use-agent-radar";
import { TERMINAL_FONT_FAMILY, TERMINAL_FONT_SIZE, TERMINAL_THEME } from "@/lib/terminal-look";
import {
	connectTerminalViewport,
	createTerminalLayoutScheduler,
	createTerminalResizeGate,
	mountTerminalViewport,
} from "@/lib/terminal-viewport";
import { Button } from "@/components/ui/button";
import { useSplitViewStore } from "@/stores/split-view";
import { createAgentTerminalAdapter } from "./agent-terminal-adapter";

const INPUT_FLUSH_MS = 16;
// Teto do delta de "voltar ao vivo": a ponte clampa no offset dela, o valor só precisa passar
// do máximo que o cliente já viu publicado.
const SCROLL_TO_LIVE = -5000;
// Setas por frame no modo forward: um flick rápido não pode voar pelo transcript do agent inteiro.
const TUI_WHEEL_ARROW_CAP = 6;
// Sem cursor (o daemon não reporta linha/coluna) e sem autowrap: cada linha é escrita na posição
// absoluta dela, e uma linha mais larga que o grid não pode empurrar a seguinte.
const SCREEN_INIT = "\u001B[?25l\u001B[?7l";

// Reescrever a tela inteira a cada quadro era o que fazia o espelho piscar. Só as linhas que
// mudaram são repintadas, endereçadas pela posição absoluta.
export function buildScreenPatch(previous: string[], lines: string[], rows: number) {
	let patch = "";
	for (let row = 0; row < rows; row++) {
		const line = lines[row] ?? "";
		if (line === previous[row]) {
			continue;
		}
		patch += `\u001B[${row + 1};1H\u001B[0m\u001B[2K${line}`;
	}

	return patch && `${patch}\u001B[0m`;
}

export function AgentTerminalView({ paneId }: { paneId: string }) {
	const { agents } = useAgentRadar();
	const cwd = agents.find((agent) => agent.paneId === paneId)?.cwd;
	const frameRef = useRef<HTMLDivElement>(null);
	const hostRef = useRef<HTMLDivElement>(null);
	const [scrolled, setScrolled] = useState(false);
	const scrollToLiveRef = useRef<() => void>(() => {});

	useEffect(() => {
		if (!frameRef.current || !hostRef.current) {
			return;
		}
		const frame = frameRef.current;
		const host = hostRef.current;
		const adapter = createAgentTerminalAdapter(paneId);

		const viewport = mountTerminalViewport({
			host,
			cwd,
			options: {
				fontSize: TERMINAL_FONT_SIZE,
				fontFamily: TERMINAL_FONT_FAMILY,
				cursorBlink: false,
				scrollback: 0,
				theme: TERMINAL_THEME,
			},
		});
		const terminal = viewport.terminal;
		terminal.write(SCREEN_INIT);

		// O grid do espelho é o do pane, e o pane agora segue o frame: com a visão aberta o
		// backend é o controller do PTY (`agentTerminal.resize`), então cols/rows saem da medida
		// da célula em vez de convergir por corpo de letra. Fonte fixa, tela cheia, um pedido por
		// frame no máximo — sem relayout em cadeia, não existe loop de ResizeObserver.
		let cellWidth = 0;
		let cellHeight = 0;
		let requestedCols = 0;
		let requestedRows = 0;
		let measureAttempts = 0;
		let wheelRaf = 0;
		let wheelPending = 0;
		let offset = 0;

		function scrollToLive() {
			if (offset <= 0) {
				return;
			}

			offset = 0;
			void adapter.scroll(SCROLL_TO_LIVE).catch(() => {});
		}

		function measureCell() {
			if (cellWidth && cellHeight) {
				return;
			}

			const screen = host.querySelector<HTMLElement>(".xterm-screen");
			if (!screen?.offsetWidth || !screen.offsetHeight || !terminal.cols || !terminal.rows) {
				return;
			}

			cellWidth = screen.offsetWidth / terminal.cols;
			cellHeight = screen.offsetHeight / terminal.rows;
		}

		function fit() {
			measureCell();
			if (!cellWidth || !cellHeight || !frame.clientWidth || !frame.clientHeight) {
				// O primeiro layout do xterm pode perder o primeiro frame; tenta de novo até medir.
				if ((!cellWidth || !cellHeight) && measureAttempts++ < 20) {
					layout.request();
				}
				return;
			}

			const cols = Math.max(2, Math.floor(frame.clientWidth / cellWidth));
			const rows = Math.max(2, Math.floor(frame.clientHeight / cellHeight));
			if (cols === requestedCols && rows === requestedRows) {
				return;
			}

			requestedCols = cols;
			requestedRows = rows;
			void adapter.resize(cols, rows).catch(() => {});
		}

		const layout = createTerminalLayoutScheduler(fit);
		const resize = createTerminalResizeGate(() => layout.request());
		resize.setPaused(useSplitViewStore.getState().resizing);
		const unsubscribe = useSplitViewStore.subscribe((state) => resize.setPaused(state.resizing));

		// Uma chamada por tecla deixava a digitação atrás do usuário; o buffer junta a rajada e manda
		// tudo num pacote só. A tradução para o vocabulário de teclas do daemon é do backend. Tecla
		// também devolve o espelho ao vivo: ninguém digita querendo olhar o histórico.
		let pending = "";
		let flush: ReturnType<typeof setTimeout> | null = null;
		terminal.onData((data) => {
			scrollToLive();
			pending += data;
			if (flush) {
				return;
			}
			flush = setTimeout(() => {
				flush = null;
				const text = pending;
				pending = "";
				void adapter.input(text).catch(() => {});
			}, INPUT_FLUSH_MS);
		});

		// O wheel é nosso: rola o histórico real do pane pela ponte. Devolver false tira o xterm do
		// caminho — com scrollback 0 ele convertia cada rolagem em seta ↑/↓ pro pane, e o transcript
		// do TUI scrollava sozinho entre prompts antigos em vez de mover a tela do espelho. Quando a
		// ponte responde "forward" (pane sem scrollback: TUI em alt screen), o gesto vira seta
		// DELIBERADA pro agent — é o transcript dele que existe acima, e rolar o mouse passa a
		// percorrê-lo como num terminal de verdade.
		terminal.attachCustomWheelEventHandler((event) => {
			if (!event.deltaY) {
				return false;
			}

			wheelPending += event.deltaY;
			if (!wheelRaf) {
				wheelRaf = requestAnimationFrame(() => {
					wheelRaf = 0;
					const lines = Math.round(wheelPending / (cellHeight || 19));
					wheelPending = 0;
					if (!lines) {
						return;
					}

					void adapter
						.scroll(-lines)
						.then((resposta) => {
							if (!resposta.ok || resposta.mode !== "forward") {
								return;
							}

							const seta = lines < 0 ? "\u001B[A" : "\u001B[B";
							const data = seta.repeat(Math.min(Math.abs(lines), TUI_WHEEL_ARROW_CAP));
							void adapter.input(data).catch(() => {});
						})
						.catch(() => {});
				});
			}

			return false;
		});

		let previous: string[] = [];
		let cols = 0;
		let rows = 0;

		function paint(screen: { ansi: string; cols: number; rows: number; offset: number }) {
			offset = screen.offset;
			setScrolled(offset > 0);
			if (screen.cols !== cols || screen.rows !== rows) {
				cols = screen.cols;
				rows = screen.rows;
				terminal.resize(cols, rows);
				terminal.reset();
				terminal.write(SCREEN_INIT);
				previous = [];
			}

			const lines = screen.ansi.split(/\r?\n/);
			const patch = buildScreenPatch(previous, lines, rows);
			previous = lines;
			if (patch) {
				terminal.write(patch);
			}
		}

		const observer = new ResizeObserver(() => resize.request());
		observer.observe(frame);
		layout.request();
		scrollToLiveRef.current = scrollToLive;

		const disconnect = connectTerminalViewport({
			label: "Terminal do agent",
			subscribe: adapter.subscribe,
			onEvent: paint,
			onReconnect: () => {
				previous = [];
			},
		});

		return () => {
			if (wheelRaf) {
				cancelAnimationFrame(wheelRaf);
			}
			disconnect();
			observer.disconnect();
			unsubscribe();
			layout.dispose();
			if (flush) {
				clearTimeout(flush);
			}
			viewport.dispose();
		};
	}, [paneId, cwd]);

	return (
		<div
			ref={frameRef}
			data-component="agent-terminal"
			className="relative grid min-h-0 min-w-0 flex-1 overflow-hidden bg-background"
			onClick={() => hostRef.current?.querySelector<HTMLElement>(".xterm-helper-textarea")?.focus()}
		>
			<div ref={hostRef} className="m-auto" />
			{scrolled && (
				<Button
					variant="outline"
					size="sm"
					className="absolute right-3 bottom-3 z-10 h-7 gap-1.5 px-2 text-xs"
					onClick={(event) => {
						event.stopPropagation();
						scrollToLiveRef.current();
					}}
				>
					<History className="size-3.5" />
					histórico do pane
				</Button>
			)}
		</div>
	);
}
