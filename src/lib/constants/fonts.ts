type FontDef = {
	label: string;
	family: string;
};

export const FONTS = {
	"jetbrains-mono": {
		label: "JetBrains Mono",
		family: '"JetBrains Mono", "Fira Code", monospace',
	},
	"ibm-plex-mono": {
		label: "IBM Plex Mono",
		family: '"IBM Plex Mono", monospace',
	},
	"fira-code": {
		label: "Fira Code",
		family: '"Fira Code", monospace',
	},
	"geist-mono": {
		label: "Geist Mono",
		family: '"Geist Mono", monospace',
	},
	"space-mono": {
		label: "Space Mono",
		family: '"Space Mono", monospace',
	},
	inter: {
		label: "Inter",
		family: '"Inter", system-ui, sans-serif',
	},
	"ibm-plex-sans": {
		label: "IBM Plex Sans",
		family: '"IBM Plex Sans", system-ui, sans-serif',
	},
	geist: {
		label: "Geist",
		family: '"Geist", system-ui, sans-serif',
	},
	atkinson: {
		label: "Atkinson Hyperlegible",
		family: '"Atkinson Hyperlegible", system-ui, sans-serif',
	},
	"source-serif": {
		label: "Source Serif 4",
		family: '"Source Serif 4", Georgia, serif',
	},
} as const satisfies Record<string, FontDef>;

export type FontId = keyof typeof FONTS;

export const DEFAULT_UI_FONT: FontId = "ibm-plex-sans";
export const DEFAULT_READING_FONT: FontId = "atkinson";
