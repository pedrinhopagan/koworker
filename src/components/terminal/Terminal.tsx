import { useEffect, useMemo, useRef, useState } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";

import { cn } from "@/lib/utils";
import { onPtyData, onPtyExit, ptyResize, ptyWrite } from "@/desktop/pty/client";
import { isTauri } from "@/lib/tauri";

type Props = {
	sessionId: string;
	className?: string;
	sessionLabel?: string;
	onExit?: (code: number) => void;
	isVisible?: boolean;
};

export function Terminal({ sessionId, className, sessionLabel, onExit, isVisible = true }: Props) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const termRef = useRef<XTerm | null>(null);
	const fitRef = useRef<FitAddon | null>(null);
	const statusRef = useRef<"connecting" | "ready" | "exited">("connecting");

	const [status, setStatus] = useState<"connecting" | "ready" | "exited">("connecting");
	const [exitCode, setExitCode] = useState<number | null>(null);

	const tauri = useMemo(() => isTauri(), []);

	useEffect(() => {
		if (!isVisible) return;
		const term = termRef.current;
		const fit = fitRef.current;
		const el = containerRef.current;
		if (!term || !fit || !el) return;
		const timer = window.setTimeout(() => {
			const rect = el.getBoundingClientRect();
			if (rect.width < 2 || rect.height < 2) return;
			try {
				fit.fit();
				void ptyResize(sessionId, term.cols, term.rows);
			} catch {}
		}, 120);
		return () => window.clearTimeout(timer);
	}, [isVisible, sessionId]);

	useEffect(() => {
		if (!tauri) {
			return;
		}

		let disposed = false;
		let disposeTimer: number | null = null;
		const el = containerRef.current;
		if (!el) {
			return;
		}

		const fit = new FitAddon();
		const term = new XTerm({
			rendererType: "dom",
			cursorBlink: true,
			convertEol: true,
			fontFamily: "var(--font-mono)",
			fontSize: 12,
			lineHeight: 1.25,
			scrollback: 5000,
			theme: {
				background: "#0f1115",
				foreground: "#e2e8f0",
				cursor: "#94a3b8",
				selection: "#334155",
			},
		});

		fitRef.current = fit;
		termRef.current = term;

		term.loadAddon(fit);
		term.open(el);
		try {
			fit.fit();
		} catch {}
		term.focus();

		// Best effort: ensure backend PTY matches our initial dimensions.
		void ptyResize(sessionId, term.cols, term.rows);

		statusRef.current = "ready";
		setStatus("ready");

		const dataDisposable = term.onData((data) => {
			if (disposed) return;
			void ptyWrite(sessionId, data);
		});

		let raf = 0;
		const ro = new ResizeObserver(() => {
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(() => {
				if (
					disposed ||
					!termRef.current ||
					!fitRef.current ||
					!isVisible ||
					statusRef.current === "exited"
				)
					return;
				try {
					const rect = el.getBoundingClientRect();
					if (rect.width < 2 || rect.height < 2) return;
					fit.fit();
					void ptyResize(sessionId, term.cols, term.rows);
				} catch {}
			});
		});
		ro.observe(el);

		let unlistenData: (() => void) | null = null;
		let unlistenExit: (() => void) | null = null;

		void onPtyData((payload) => {
			if (payload.sessionId !== sessionId) {
				return;
			}
			if (disposed) return;
			term.write(payload.data);
		}).then((fn) => {
			unlistenData = fn;
		});

		void onPtyExit((payload) => {
			if (payload.sessionId !== sessionId) {
				return;
			}
			if (disposed) return;
			statusRef.current = "exited";
			setStatus("exited");
			setExitCode(payload.code);
			onExit?.(payload.code);
		}).then((fn) => {
			unlistenExit = fn;
		});

		return () => {
			disposed = true;
			cancelAnimationFrame(raf);
			ro.disconnect();
			dataDisposable.dispose();
			unlistenData?.();
			unlistenExit?.();
			disposeTimer = window.setTimeout(() => {
				term.dispose();
				termRef.current = null;
				fitRef.current = null;
			}, 80);
		};
	}, [sessionId, tauri, onExit, isVisible]);

	if (!tauri) {
		return (
			<div
				className={cn(
					"rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground",
					className,
				)}
			>
				Terminal embutido disponível apenas no app Desktop (Tauri).
			</div>
		);
	}

	const statusLabel =
		status === "connecting" ? "Conectando" : status === "ready" ? "Ativo" : "Encerrado";
	const displaySession = sessionLabel ?? sessionId;
	const exitLabel = exitCode !== null && status === "exited" ? `(${exitCode})` : null;

	return (
		<div
			className={cn(
				"flex min-h-0 flex-col overflow-hidden rounded-md border bg-background shadow-sm",
				className,
			)}
		>
			<div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-3 py-2">
				<div className="min-w-0 truncate text-xs text-muted-foreground">
					Sessão: <span className="font-mono">{displaySession}</span>
				</div>
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					{exitLabel && <span>{exitLabel}</span>}
					<span
						className={cn(
							"rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
							status === "ready" && "border-emerald-300/50 text-emerald-700",
							status === "connecting" && "border-amber-300/60 text-amber-700",
							status === "exited" && "border-rose-300/60 text-rose-700",
						)}
					>
						{statusLabel}
					</span>
				</div>
			</div>
			<div
				ref={containerRef}
				className="min-h-[260px] flex-1 overflow-hidden bg-[#0f1115]"
			/>
		</div>
	);
}
