// Presets de emulador de terminal. Cada template é um comando com os placeholders `{title}` e
// `{command}`, substituídos na hora de abrir o terminal. O usuário escolhe um preset ou escreve o
// próprio template — a fatia de terminal-no-backend consome a string final. Dados de domínio puros
// (sem `process`/`node`), então servem tanto o backend quanto a tela de configurações.
export const TERMINAL_PRESETS = {
	alacritty: {
		label: "Alacritty",
		template: "alacritty --title {title} -e {command}",
	},
	kitty: {
		label: "kitty",
		template: "kitty --title {title} {command}",
	},
	wezterm: {
		label: "WezTerm",
		template: "wezterm start --class {title} -- {command}",
	},
	"gnome-terminal": {
		label: "GNOME Terminal",
		template: "gnome-terminal --title {title} -- {command}",
	},
	konsole: {
		label: "Konsole",
		template: "konsole -p tabtitle={title} -e {command}",
	},
	wt: {
		label: "Windows Terminal",
		template: "wt --title {title} {command}",
	},
	"macos-terminal": {
		label: "Terminal.app (macOS)",
		template: `osascript -e 'tell application "Terminal" to do script "{command}"'`,
	},
} as const;

export type TerminalPresetId = keyof typeof TERMINAL_PRESETS;

export const TERMINAL_MULTIPLEXERS = ["tmux", "none"] as const;

export type TerminalMultiplexer = (typeof TERMINAL_MULTIPLEXERS)[number];

export const TERMINAL_MULTIPLEXER_LABEL: Record<TerminalMultiplexer, string> = {
	tmux: "tmux (sessões persistentes)",
	none: "Nenhum (uma janela por abertura)",
};

// A tela mostra qual preset está ativo comparando o template salvo com os presets conhecidos. Sem
// correspondência = template personalizado.
export function matchTerminalPreset(template: string): TerminalPresetId | null {
	const entries = Object.entries(TERMINAL_PRESETS) as [TerminalPresetId, { template: string }][];
	return entries.find(([, preset]) => preset.template === template)?.[0] ?? null;
}
