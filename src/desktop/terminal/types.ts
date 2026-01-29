export const idsPresetTerminal = [
	"auto",
	"konsole",
	"gnome-terminal",
	"alacritty",
	"kitty",
	"wezterm",
	"terminal",
	"iterm",
] as const;

export type PresetTerminalId = (typeof idsPresetTerminal)[number];

export type PlataformaTerminal = "linux" | "darwin" | "win32";

export type PresetTerminal = {
	id: PresetTerminalId;
	nome: string;
	plataformas: PlataformaTerminal[];
	comando: string;
	args: string[];
	suportaExecucao: boolean;
};

export type ConfigTmux = {
	sessao: string;
	autoCriar: boolean;
};

export type ConfigTerminal = {
	presetId: PresetTerminalId;
	comandoPersonalizado?: {
		bin: string;
		args: string[];
	};
	tmux: ConfigTmux;
};
