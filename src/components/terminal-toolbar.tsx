import type { Terminal } from "@xterm/xterm";
import {
	ArrowDown,
	ArrowDownToLine,
	ArrowLeft,
	ArrowRight,
	ArrowUp,
	ClipboardCopy,
	ClipboardPaste,
	Keyboard,
	KeyboardOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { reconnectRealtime } from "@/client";

export function TerminalConnectionStatus() {
	return (
		<div
			role="status"
			className="absolute inset-x-0 top-0 z-20 flex min-h-12 items-center justify-between gap-2 border-b border-border bg-chrome px-3 text-xs"
		>
			<span>Conectando ao terminal…</span>
			<Button variant="outline" size="sm" onClick={reconnectRealtime}>
				Reconectar
			</Button>
		</div>
	);
}

const TERMINAL_KEYS = [
	{ label: "Esc", data: "\u001B" },
	{ label: "Tab", data: "\t" },
	{ label: "Ctrl+C", data: "\u0003" },
	{ label: "↑", name: "Seta para cima", data: "\u001B[A", icon: ArrowUp },
	{ label: "↓", name: "Seta para baixo", data: "\u001B[B", icon: ArrowDown },
	{ label: "←", name: "Seta para esquerda", data: "\u001B[D", icon: ArrowLeft },
	{ label: "→", name: "Seta para direita", data: "\u001B[C", icon: ArrowRight },
	{ label: "Enter", data: "\r" },
	{ label: "⌫", name: "Apagar caractere", data: "\u007F" },
	{ label: "Shift+Tab", data: "\u001B[Z" },
	{ label: "Ctrl+D", data: "\u0004" },
	{ label: "Ctrl+L", data: "\u000C" },
] as const;

export function TerminalToolbar({
	terminal,
	disabled,
	onScrollToEnd,
}: {
	terminal: Terminal | null;
	disabled: boolean;
	onScrollToEnd: () => void;
}) {
	const [focused, setFocused] = useState(false);
	useEffect(() => {
		const textarea = terminal?.textarea;
		if (!textarea) {
			return;
		}
		const focus = () => setFocused(true);
		const blur = () => setFocused(false);
		textarea.addEventListener("focus", focus);
		textarea.addEventListener("blur", blur);
		return () => {
			textarea.removeEventListener("focus", focus);
			textarea.removeEventListener("blur", blur);
		};
	}, [terminal]);

	async function copy() {
		if (!terminal) {
			return;
		}
		const buffer = terminal.buffer.active;
		const text =
			terminal.getSelection() ||
			Array.from(
				{ length: terminal.rows },
				(_, row) => buffer.getLine(buffer.viewportY + row)?.translateToString(true) ?? "",
			).join("\n");
		try {
			await navigator.clipboard.writeText(text);
			toast.success("Texto copiado");
		} catch {
			toast.error("Não foi possível acessar a área de transferência");
		}
	}

	async function paste() {
		try {
			const text = await navigator.clipboard.readText();
			terminal?.paste(text);
		} catch {
			toast.error("Use Colar no menu do teclado do celular");
		}
	}

	return (
		<div
			data-component="terminal-toolbar"
			className="flex shrink-0 items-center border-t border-border bg-chrome lg:hidden [@media(pointer:coarse)]:flex"
		>
			<Button
				variant="ghost"
				className="h-12 w-12 px-0"
				aria-label={focused ? "Ocultar teclado" : "Abrir teclado"}
				disabled={disabled || !terminal}
				onPointerDown={(event) => event.preventDefault()}
				onClick={() => (focused ? terminal?.blur() : terminal?.focus())}
			>
				{focused && <KeyboardOff className="size-4" />}
				{!focused && <Keyboard className="size-4" />}
			</Button>
			<div className="flex min-w-0 flex-1 overflow-x-auto overscroll-x-contain touch-pan-x">
				{TERMINAL_KEYS.map((key) => (
					<Button
						key={key.label}
						variant="ghost"
						className="h-12 min-w-12 px-3 font-mono text-xs"
						disabled={disabled || !terminal}
						aria-label={"name" in key ? key.name : key.label}
						onPointerDown={(event) => event.preventDefault()}
						onClick={() => terminal?.input(key.data, true)}
					>
						{"icon" in key && <key.icon className="size-4" />}
						{!("icon" in key) && key.label}
					</Button>
				))}
				<Button
					variant="ghost"
					className="size-12"
					aria-label="Copiar seleção ou tela"
					onClick={() => void copy()}
				>
					<ClipboardCopy />
				</Button>
				<Button
					variant="ghost"
					className="size-12"
					aria-label="Colar no terminal"
					disabled={disabled || !terminal}
					onClick={() => void paste()}
				>
					<ClipboardPaste />
				</Button>
				<Button
					variant="ghost"
					className="size-12"
					aria-label="Ir para o fim do terminal"
					onClick={onScrollToEnd}
				>
					<ArrowDownToLine />
				</Button>
			</div>
		</div>
	);
}
