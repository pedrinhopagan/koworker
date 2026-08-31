import { FitAddon } from "@xterm/addon-fit";
import { useEffect, useRef } from "react";

import type { ShellStreamEvent } from "@/api/pubsub";
import { TERMINAL_FONT_FAMILY, TERMINAL_FONT_SIZE, TERMINAL_THEME } from "@/lib/terminal-look";
import {
	connectTerminalViewport,
	createTerminalLayoutScheduler,
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
	onTitle?: (title: string) => void;
	onStatus?: (status: "live" | "exited" | "closed", exitCode?: number | null) => void;
};

export function ShellTerminal({ shellId, cwd, className, onTitle, onStatus }: ShellTerminalProps) {
	const hostRef = useRef<HTMLDivElement>(null);

	// Callbacks vivem em ref: o efeito é dono da instância do xterm e não pode reciclar
	// terminal vivo porque a tela do pai recriou as funções de callback.
	const handlers = useRef({ onTitle, onStatus });
	handlers.current = { onTitle, onStatus };

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
				theme: TERMINAL_THEME,
			},
			prepare: (terminal) => terminal.loadAddon(fit),
		});
		const term = viewport.terminal;

		// Em alt screen o buffer não tem scrollback e o xterm converte o wheel em seta ↑/↓ pro
		// processo — rolar o mouse em TUI sem mouse reporting mexia no app em vez de não fazer
		// nada, como no alacritty. TUI com mouse reporting não passa por aqui (o caminho de mouse
		// roda antes) e segue recebendo o wheel.
		term.attachCustomWheelEventHandler(() => term.buffer.active.type !== "alternate");

		let disposed = false;

		function fitNow() {
			if (disposed) {
				return;
			}

			const dimensions = fit.proposeDimensions();
			if (!dimensions || dimensions.cols < 2 || dimensions.rows < 2) {
				return;
			}

			fit.fit();
			void adapter.resize(dimensions.cols, dimensions.rows).catch(() => {});
		}
		const layout = createTerminalLayoutScheduler(fitNow);
		const resize = createTerminalResizeGate(() => layout.request());
		resize.setPaused(useSplitViewStore.getState().resizing);

		const observer = new ResizeObserver(() => {
			resize.request();
		});
		observer.observe(host);

		const unsubscribe = useSplitViewStore.subscribe((state) => resize.setPaused(state.resizing));

		term.onData((data) => {
			void adapter.input(data).catch(() => {});
		});

		function handle(event: ShellStreamEnvelope) {
			if (event.type === "replay") {
				term.reset();
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
			onReconnect: () => {
				handlers.current.onStatus?.("live");
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

	return <div ref={hostRef} data-component="shell-terminal" className={className} />;
}
