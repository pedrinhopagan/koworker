import type { Terminal } from "@xterm/xterm";
import { toast } from "sonner";
import { TerminalConnectionStatus, TerminalToolbar } from "@/components/terminal-toolbar";
import { errorMessage } from "@/lib/orpc-errors";
import { History } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAgentRadar } from "@/hooks/use-agent-radar";
import { TERMINAL_FONT_FAMILY, TERMINAL_FONT_SIZE } from "@/lib/terminal-look";
import {
	connectTerminalViewport,
	createTerminalLayoutScheduler,
	createTerminalInputQueue,
	createTerminalResizeGate,
	mountTerminalViewport,
} from "@/lib/terminal-viewport";
import { Button } from "@/components/ui/button";
import { useSplitViewStore } from "@/stores/split-view";
import { createAgentTerminalAdapter } from "./agent-terminal-adapter";

const SCROLL_TO_LIVE = -5000;
const TUI_WHEEL_ARROW_CAP = 6;
const SCREEN_INIT = "\u001B[?25l\u001B[?7l";

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
	const [terminalInstance, setTerminalInstance] = useState<Terminal | null>(null);
	const [connected, setConnected] = useState(false);
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
			scroll: (lines) => queueScroll(lines),
			options: {
				fontSize: TERMINAL_FONT_SIZE,
				fontFamily: TERMINAL_FONT_FAMILY,
				cursorBlink: false,
				scrollback: 0,
			},
		});
		const terminal = viewport.terminal;
		setTerminalInstance(terminal);
		terminal.write(SCREEN_INIT);

		let cellWidth = 0;
		let cellHeight = 0;
		let requestedCols = 0;
		let requestedRows = 0;
		let measureAttempts = 0;
		let wheelRaf = 0;
		let wheelPending = 0;
		let offset = 0;
		let disposed = false;
		let online = false;
		terminal.options.disableStdin = true;
		let scrolling = false;

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
			void adapter
				.resize(cols, rows)
				.then((result) => {
					if (!result.ok) {
						requestedCols = requestedRows = 0;
					}
				})
				.catch(() => {
					requestedCols = requestedRows = 0;
				});
		}

		const layout = createTerminalLayoutScheduler(fit);
		const resize = createTerminalResizeGate(() => layout.request());
		resize.setPaused(useSplitViewStore.getState().resizing);
		const unsubscribe = useSplitViewStore.subscribe((state) => resize.setPaused(state.resizing));

		const send = createTerminalInputQueue({
			send: async (data) => {
				if (disposed || !online) {
					throw new Error("Terminal desconectado; entrada não enviada");
				}
				return await adapter.input(data);
			},
			onError: (error) =>
				toast.error(
					errorMessage(
						error,
						"Falha ao enviar ao terminal. Confira a conexão antes de tentar novamente.",
					),
				),
		});
		terminal.onData((data) => {
			scrollToLive();
			void send(data);
		});

		async function flushScroll() {
			wheelRaf = 0;
			if (disposed || scrolling || !wheelPending) {
				return;
			}
			scrolling = true;
			const lines = Math.max(-5000, Math.min(5000, wheelPending));
			wheelPending = 0;
			try {
				const result = await adapter.scroll(-lines);
				if (!disposed && result.ok && result.mode === "forward") {
					const arrow = lines < 0 ? "\u001B[A" : "\u001B[B";
					await send(arrow.repeat(Math.min(Math.abs(lines), TUI_WHEEL_ARROW_CAP)));
				}
			} catch (error) {
				if (!disposed) {
					toast.error(errorMessage(error, "Não foi possível rolar o terminal"), {
						id: "terminal-scroll",
					});
				}
			} finally {
				scrolling = false;
				if (!disposed && wheelPending) {
					wheelRaf = requestAnimationFrame(() => void flushScroll());
				}
			}
		}

		function queueScroll(lines: number) {
			wheelPending += lines;
			if (!scrolling && !wheelRaf) {
				wheelRaf = requestAnimationFrame(() => void flushScroll());
			}
		}

		let wheelRemainder = 0;
		terminal.attachCustomWheelEventHandler((event) => {
			event.preventDefault();
			const unit = event.deltaMode === 1 ? cellHeight || 19 : 1;
			const pixels =
				event.deltaMode === 2 ? event.deltaY * frame.clientHeight : event.deltaY * unit;
			wheelRemainder += pixels / (cellHeight || 19);
			const lines = Math.trunc(wheelRemainder);
			wheelRemainder -= lines;
			if (lines) {
				queueScroll(lines);
			}
			return false;
		});

		let previous: string[] = [];
		let cols = 0;
		let rows = 0;

		function paint(screen: { ansi: string; cols: number; rows: number; offset: number }) {
			if (disposed) {
				return;
			}
			if (!requestedCols || !requestedRows) {
				layout.request();
			}
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
			onConnectionChange: (value) => {
				online = value;
				terminal.options.disableStdin = !value;
				setConnected(value);
				requestedCols = requestedRows = 0;
				if (value) {
					layout.request();
				}
			},
			onReconnect: () => {
				previous = [];
				requestedCols = requestedRows = 0;
				layout.request();
			},
		});

		return () => {
			disposed = true;
			if (wheelRaf) {
				cancelAnimationFrame(wheelRaf);
			}
			disconnect();
			observer.disconnect();
			unsubscribe();
			layout.dispose();
			viewport.dispose();
		};
	}, [paneId, cwd]);

	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col">
			<div
				ref={frameRef}
				data-component="agent-terminal"
				className="relative grid min-h-0 min-w-0 flex-1 overflow-hidden bg-background"
			>
				{!connected && <TerminalConnectionStatus />}
				<div ref={hostRef} className="m-auto" />
				{scrolled && (
					<Button
						variant="outline"
						size="sm"
						className="absolute right-3 bottom-3 z-10 min-h-11 gap-1.5 px-3 text-xs md:min-h-8"
						onClick={(event) => {
							event.stopPropagation();
							scrollToLiveRef.current();
						}}
					>
						<History className="size-3.5" />
						Voltar ao vivo
					</Button>
				)}
			</div>
			<TerminalToolbar
				terminal={terminalInstance}
				disabled={!connected}
				onScrollToEnd={() => scrollToLiveRef.current()}
			/>
		</div>
	);
}
