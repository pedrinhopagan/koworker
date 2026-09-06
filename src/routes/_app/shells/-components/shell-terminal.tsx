import { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { TerminalConnectionStatus, TerminalToolbar } from "@/components/terminal-toolbar";
import { errorMessage } from "@/lib/orpc-errors";

import type { ShellStreamEvent } from "@/api/pubsub";
import { TERMINAL_FONT_FAMILY, TERMINAL_FONT_SIZE } from "@/lib/terminal-look";
import {
	connectTerminalViewport,
	createTerminalLayoutScheduler,
	createTerminalInputQueue,
	createTerminalResizeGate,
	mountTerminalViewport,
} from "@/lib/terminal-viewport";
import { useSplitViewStore } from "@/stores/split-view";
import { createShellViewportAdapter } from "../-utils/shell-viewport-adapter";

export type ShellStreamEnvelope = ShellStreamEvent | { type: "replay"; b64: string };

function decodeBase64(b64: string): Uint8Array {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.codePointAt(i) as number;
	}

	return bytes;
}

type ShellTerminalProps = {
	shellId: string;
	cwd?: string;
	className?: string;
	disabled?: boolean;
	onTitle?: (title: string) => void;
	onStatus?: (status: "live" | "exited" | "closed", exitCode?: number | null) => void;
};

export function ShellTerminal({
	shellId,
	cwd,
	className,
	disabled = false,
	onTitle,
	onStatus,
}: ShellTerminalProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const [terminal, setTerminal] = useState<Terminal | null>(null);
	const [connected, setConnected] = useState(false);
	const [scrolled, setScrolled] = useState(false);
	const disabledRef = useRef(disabled);
	disabledRef.current = disabled;

	const handlers = useRef({ onTitle, onStatus });
	handlers.current = { onTitle, onStatus };

	useEffect(() => {
		if (terminal) {
			terminal.options.disableStdin = disabled || !connected;
		}
	}, [terminal, disabled, connected]);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) {
			return;
		}

		const fit = new FitAddon();
		const adapter = createShellViewportAdapter(shellId);
		const viewport = mountTerminalViewport({
			host,
			cwd,
			options: {
				fontSize: TERMINAL_FONT_SIZE,
				fontFamily: TERMINAL_FONT_FAMILY,
				cursorBlink: true,
				scrollback: 10_000,
			},
			prepare: (terminal) => terminal.loadAddon(fit),
		});
		const term = viewport.terminal;
		setTerminal(term);
		term.onScroll(() => setScrolled(term.buffer.active.viewportY < term.buffer.active.baseY));

		term.attachCustomWheelEventHandler(() => term.buffer.active.type !== "alternate");

		let disposed = false;
		let online = false;
		term.options.disableStdin = true;
		let requestedCols = 0;
		let requestedRows = 0;

		function fitNow() {
			if (disposed) {
				return;
			}

			const dimensions = fit.proposeDimensions();
			if (!dimensions || dimensions.cols < 2 || dimensions.rows < 2) {
				return;
			}

			fit.fit();
			if (
				disabledRef.current ||
				(dimensions.cols === requestedCols && dimensions.rows === requestedRows)
			) {
				return;
			}
			requestedCols = dimensions.cols;
			requestedRows = dimensions.rows;
			void adapter.resize(dimensions.cols, dimensions.rows).catch(() => {
				requestedCols = requestedRows = 0;
			});
		}
		const layout = createTerminalLayoutScheduler(fitNow);
		const resize = createTerminalResizeGate(() => layout.request());
		resize.setPaused(useSplitViewStore.getState().resizing);

		const observer = new ResizeObserver(() => {
			resize.request();
		});
		observer.observe(host);

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
		term.onData((data) => {
			if (!disabledRef.current && online) {
				void send(data);
			}
		});

		function handle(event: ShellStreamEnvelope) {
			if (event.type === "replay") {
				term.reset();
				requestedCols = requestedRows = 0;
				layout.request();
				if (event.b64) {
					term.write(decodeBase64(event.b64));
				}
				return;
			}

			if (event.type === "data") {
				term.write(decodeBase64(event.b64));
				return;
			}

			if (event.type === "title") {
				handlers.current.onTitle?.(event.title);
				return;
			}

			if (event.type === "exit") {
				handlers.current.onStatus?.("exited", event.exitCode);
				return;
			}

			handlers.current.onStatus?.("closed");
		}

		const disconnect = connectTerminalViewport({
			label: "Shells",
			subscribe: adapter.subscribe,
			onEvent: handle,
			onConnectionChange: (value) => {
				online = value;
				term.options.disableStdin = !value || disabledRef.current;
				setConnected(value);
			},
			onReconnect: () => {
				requestedCols = requestedRows = 0;
				layout.request();
			},
		});

		return () => {
			disposed = true;
			disconnect();
			unsubscribe();
			observer.disconnect();
			layout.dispose();
			viewport.dispose();
		};
	}, [shellId, cwd]);

	return (
		<div data-component="shell-terminal" className={className}>
			<div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
				{!connected && <TerminalConnectionStatus />}
				<div ref={hostRef} className="h-full w-full overscroll-contain" />
				{scrolled && (
					<button
						type="button"
						onClick={() => terminal?.scrollToBottom()}
						className="absolute right-3 bottom-3 z-10 min-h-11 border border-border bg-popover px-3 text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-ring"
					>
						Ir para o fim
					</button>
				)}
			</div>
			<TerminalToolbar
				terminal={terminal}
				disabled={disabled || !connected}
				onScrollToEnd={() => terminal?.scrollToBottom()}
			/>
		</div>
	);
}
