import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";

import type { ShellStreamEvent } from "@/api/pubsub";
import { orpcWs } from "@/client";
import { subscribeWithRetry } from "@/lib/realtime-subscription";

export type ShellStreamEnvelope = ShellStreamEvent | { type: "replay"; b64: string };

function decodeBase64(b64: string): Uint8Array {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.codePointAt(i) as number;
	}

	return bytes;
}

// As cores saem das vars do tema: o renderer DOM do xterm aplica os valores como style,
// então claro/escuro acompanham o app sem paleta duplicada aqui.
const TERMINAL_THEME = {
	background: "var(--background)",
	foreground: "var(--foreground)",
	cursor: "var(--primary)",
	cursorAccent: "var(--primary-foreground)",
	selectionBackground: "var(--accent)",
};

type ShellTerminalProps = {
	shellId: string;
	className?: string;
	onTitle?: (title: string) => void;
	onStatus?: (status: "live" | "exited" | "closed", exitCode?: number | null) => void;
};

export function ShellTerminal({ shellId, className, onTitle, onStatus }: ShellTerminalProps) {
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

		const term = new Terminal({
			fontSize: 13,
			fontFamily:
				'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
			cursorBlink: true,
			scrollback: 10_000,
			theme: TERMINAL_THEME,
		});
		const fit = new FitAddon();
		term.loadAddon(fit);
		term.open(host);
		term.focus();

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
			void orpcWs.shells.resize
				.call({ id: shellId, cols: dimensions.cols, rows: dimensions.rows })
				.catch(() => {});
		}

		const observer = new ResizeObserver(() => fitNow());
		observer.observe(host);

		term.onData((data) => {
			void orpcWs.shells.input.call({ id: shellId, data }).catch(() => {});
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

		const controller = new AbortController();

		void subscribeWithRetry({
			label: "Shells",
			signal: controller.signal,
			subscribe: (signal) => orpcWs.shells.stream.call({ id: shellId }, { signal }),
			onEvent: handle,
			onReconnect: () => {
				handlers.current.onStatus?.("live");
			},
		});

		return () => {
			disposed = true;
			controller.abort();
			observer.disconnect();
			term.dispose();
		};
	}, [shellId]);

	return <div ref={hostRef} data-component="shell-terminal" className={className} />;
}
