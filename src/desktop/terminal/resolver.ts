import { presetsTerminalPorId } from "./presets";
import type { PlataformaTerminal, PresetTerminalId } from "./types";

const plataformasValidas = new Set<PlataformaTerminal>(["linux", "darwin", "win32"]);

const preferidosPorPlataforma: Record<PlataformaTerminal, PresetTerminalId[]> = {
	linux: ["konsole", "gnome-terminal", "alacritty", "kitty", "wezterm"],
	darwin: ["terminal", "iterm"],
	win32: [],
};

function normalizarPlataforma(plataforma: NodeJS.Platform): PlataformaTerminal {
	return plataformasValidas.has(plataforma as PlataformaTerminal)
		? (plataforma as PlataformaTerminal)
		: "linux";
}

export function resolverPresetTerminal(
	plataforma: NodeJS.Platform = process.platform,
): PresetTerminalId {
	const plataformaNormalizada = normalizarPlataforma(plataforma);
	const preferidos = preferidosPorPlataforma[plataformaNormalizada];

	for (const id of preferidos) {
		const preset = presetsTerminalPorId[id];
		if (preset.comando && Bun.which(preset.comando)) {
			return id;
		}
	}

	return "auto";
}
