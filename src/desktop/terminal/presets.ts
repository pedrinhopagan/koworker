import type { PresetTerminal, PresetTerminalId } from "./types";

export const presetsTerminal: PresetTerminal[] = [
	{
		id: "auto",
		nome: "Auto",
		plataformas: ["linux", "darwin"],
		comando: "",
		args: [],
		suportaExecucao: false,
	},
	{
		id: "konsole",
		nome: "Konsole",
		plataformas: ["linux"],
		comando: "konsole",
		args: ["-e"],
		suportaExecucao: true,
	},
	{
		id: "gnome-terminal",
		nome: "GNOME Terminal",
		plataformas: ["linux"],
		comando: "gnome-terminal",
		args: ["--"],
		suportaExecucao: true,
	},
	{
		id: "alacritty",
		nome: "Alacritty",
		plataformas: ["linux"],
		comando: "alacritty",
		args: ["-e"],
		suportaExecucao: true,
	},
	{
		id: "kitty",
		nome: "Kitty",
		plataformas: ["linux"],
		comando: "kitty",
		args: ["-e"],
		suportaExecucao: true,
	},
	{
		id: "wezterm",
		nome: "WezTerm",
		plataformas: ["linux"],
		comando: "wezterm",
		args: ["start", "--"],
		suportaExecucao: true,
	},
	{
		id: "terminal",
		nome: "Terminal.app",
		plataformas: ["darwin"],
		comando: "open",
		args: ["-a", "Terminal"],
		suportaExecucao: false,
	},
	{
		id: "iterm",
		nome: "iTerm",
		plataformas: ["darwin"],
		comando: "open",
		args: ["-a", "iTerm"],
		suportaExecucao: false,
	},
];

export const presetsTerminalPorId = Object.fromEntries(
	presetsTerminal.map((preset) => [preset.id, preset]),
) as Record<PresetTerminalId, PresetTerminal>;
