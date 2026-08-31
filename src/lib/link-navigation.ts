import type { Terminal } from "@xterm/xterm";
import { toast } from "sonner";

import { orpc } from "@/client";

const LINK_PATTERN =
	/https?:\/\/[^\s<>"']+|file:\/\/\/[^\s<>"']+|(?:^|\s)(\.{0,2}\/[^\s<>"']+|\/[^\s<>"']+)/g;

export function fileHref(path: string) {
	return `file://${path
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/")}`;
}

export async function openLinkTarget(target: string, cwd?: string) {
	if (/^(https?:|mailto:)/i.test(target)) {
		window.open(target, "_blank", "noopener,noreferrer");
		return;
	}

	const result = await orpc.system.resolveLink.call({ target, ...(cwd ? { cwd } : {}) });

	if (result.kind === "internal") {
		window.location.assign(result.href);
		return;
	}

	// `file://` não navega a partir de uma página http (e o Electron nega o `window.open`): quem abre
	// o arquivo no app padrão é o backend, que roda na máquina do usuário.
	if (result.kind === "file") {
		await orpc.system.openPath
			.call({ path: result.path })
			.catch((error: Error) => toast.error(`Não foi possível abrir o arquivo: ${error.message}`));
		return;
	}

	if (result.kind === "external") {
		window.open(result.href, "_blank", "noopener,noreferrer");
	}
}

export function registerTerminalLinks(terminal: Terminal, cwd?: string) {
	return terminal.registerLinkProvider({
		provideLinks(lineNumber, callback) {
			const line = terminal.buffer.active.getLine(lineNumber - 1)?.translateToString(true) ?? "";
			const links = [...line.matchAll(LINK_PATTERN)].map((match) => {
				const raw = match[1] ?? match[0];
				const leading = match[0].length - match[0].trimStart().length;
				const start = (match.index ?? 0) + leading + 1;
				return {
					range: {
						start: { x: start, y: lineNumber },
						end: { x: start + raw.length - 1, y: lineNumber },
					},
					text: raw,
					decorations: { pointerCursor: true, underline: true },
					activate(_event: MouseEvent, text: string) {
						void openLinkTarget(text, cwd);
					},
				};
			});

			callback(links.length ? links : undefined);
		},
	});
}
