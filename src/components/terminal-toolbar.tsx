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

import { ThreadComposer } from "@/components/agent-session/thread-composer";
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
	const [typing, setTyping] = useState(false);
	useEffect(() => {
		const textarea = terminal?.textarea;
		if (!textarea) {
			return;
		}
		// No toque a tela é para ler e a escrita mora no composer: tocar no terminal não sobe o
		// teclado. Digitar direto (vim, prompt de senha) é o botão de teclado, até o foco sair.
		const touch = window.matchMedia("(pointer: coarse)").matches;
		if (touch) {
			textarea.inputMode = "none";
		}
		const blur = () => {
			setTyping(false);
			if (touch) {
				textarea.inputMode = "none";
			}
		};
		textarea.addEventListener("blur", blur);
		return () => textarea.removeEventListener("blur", blur);
	}, [terminal]);

	function toggleKeyboard() {
		if (!terminal?.textarea) {
			return;
		}
		if (typing) {
			terminal.blur();
			return;
		}
		terminal.textarea.inputMode = "text";
		terminal.blur();
		terminal.focus();
		setTyping(true);
	}

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
				aria-label={typing ? "Parar de digitar no terminal" : "Digitar direto no terminal"}
				disabled={disabled || !terminal}
				onPointerDown={(event) => event.preventDefault()}
				onClick={toggleKeyboard}
			>
				{typing && <KeyboardOff className="size-4" />}
				{!typing && <Keyboard className="size-4" />}
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

// A escrita do terminal no celular: o mesmo composer da conversa (rascunho, ditado, colar,
// multilinha), e o texto vai ao terminal seguido de Enter. É o que faz qualquer shell virar chat,
// mesmo quando não existe transcript para mostrar.
export function TerminalComposer({
	draftKey,
	cli,
	projectName,
	disabled,
	onSend,
}: {
	draftKey: string;
	cli?: string | null;
	projectName?: string | null;
	disabled: boolean;
	onSend: (text: string) => Promise<boolean>;
}) {
	const [pending, setPending] = useState(false);

	async function submit(text: string) {
		setPending(true);
		try {
			return await onSend(text);
		} finally {
			setPending(false);
		}
	}

	return (
		<div
			data-component="terminal-composer"
			className="shrink-0 bg-background px-2 lg:hidden [@media(pointer:coarse)]:block"
		>
			<ThreadComposer
				draftKey={draftKey}
				{...(cli ? { cli } : {})}
				{...(projectName ? { projectName } : {})}
				disabled={disabled}
				pending={pending}
				hint="Conectando ao terminal…"
				disabledHintInline
				placeholder="Escreva para o terminal…"
				helperText="Vai como texto seguido de Enter."
				onSubmit={submit}
			/>
		</div>
	);
}
