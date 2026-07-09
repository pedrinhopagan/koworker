// Foco de janela: best-effort. Traz o terminal do projeto (título "<projeto> - Kowork") pra frente
// via xdotool (X11) ou kdotool (Wayland). Qualquer falha — sem display gráfico, binário ausente,
// emulador que não casa a classe — é ignorada: o terminal só não ganha foco, não quebra a abertura.
// `windowClass` é genérico (default Alacritty, o preset do modo tmux); outros modos passam a sua.

async function toolOutput(cmd: string[]): Promise<string> {
	try {
		const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "ignore", stdin: "ignore" });
		const text = await new Response(proc.stdout).text();
		await proc.exited;

		return text;
	} catch {
		return "";
	}
}

function isWayland(): boolean {
	return !!process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === "wayland";
}

function toLines(output: string): string[] {
	return output
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

export async function focusTerminalWindow(
	projectName: string,
	windowClass = "Alacritty",
): Promise<void> {
	const title = `${projectName} - Kowork`;
	const wayland = isWayland();
	const tool = wayland ? "kdotool" : "xdotool";

	// Interseção: a janela que casa o título do projeto E é da classe informada (o foco só faz sentido
	// pro emulador do preset; outros emuladores simplesmente não focam).
	const titleIds = new Set(toLines(await toolOutput([tool, "search", "--name", title])));
	const classIds = toLines(await toolOutput([tool, "search", "--class", windowClass]));
	const match = classIds.find((id) => titleIds.has(id));
	if (!match) {
		return;
	}

	if (wayland) {
		await toolOutput(["kdotool", "windowactivate", match]);
		return;
	}

	await toolOutput(["xdotool", "windowactivate", "--sync", match]);
	await toolOutput(["xdotool", "windowraise", match]);
}
