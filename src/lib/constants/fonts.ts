// Catálogo de fontes disponíveis para a interface e para a leitura de .md/prompts.
// As famílias precisam estar carregadas no <link> do Google Fonts em src/index.html.
// `family` é o valor cru de font-family que a store injeta em --app-font / --reading-font.

type FontCategory = "mono" | "sans" | "serif";

type FontDef = {
	label: string;
	family: string;
	category: FontCategory;
	note: string;
};

export const FONTS = {
	"jetbrains-mono": {
		label: "JetBrains Mono",
		family: '"JetBrains Mono", "Fira Code", monospace',
		category: "mono",
		note: "A atual. Mono nítida e técnica, mas densa para textos longos.",
	},
	"ibm-plex-mono": {
		label: "IBM Plex Mono",
		family: '"IBM Plex Mono", monospace',
		category: "mono",
		note: "Mono com x-height alto e formas humanas — lê melhor que a maioria.",
	},
	"fira-code": {
		label: "Fira Code",
		family: '"Fira Code", monospace',
		category: "mono",
		note: "Mono clássica de código, ligaduras e ótimo contraste.",
	},
	"geist-mono": {
		label: "Geist Mono",
		family: '"Geist Mono", monospace',
		category: "mono",
		note: "Mono moderna e neutra da Vercel, bem equilibrada.",
	},
	"space-mono": {
		label: "Space Mono",
		family: '"Space Mono", monospace',
		category: "mono",
		note: "Mono com personalidade retrô — ótima para títulos, cansa em corpo.",
	},
	inter: {
		label: "Inter",
		family: '"Inter", system-ui, sans-serif',
		category: "sans",
		note: "Sans humanista, padrão de UI. Confortável para ler e escrever.",
	},
	"ibm-plex-sans": {
		label: "IBM Plex Sans",
		family: '"IBM Plex Sans", system-ui, sans-serif',
		category: "sans",
		note: "Sans techy que combina com a IBM Plex Mono sem destoar.",
	},
	geist: {
		label: "Geist",
		family: '"Geist", system-ui, sans-serif',
		category: "sans",
		note: "Sans geométrica e limpa, par natural da Geist Mono.",
	},
	atkinson: {
		label: "Atkinson Hyperlegible",
		family: '"Atkinson Hyperlegible", system-ui, sans-serif',
		category: "sans",
		note: "Desenhada para legibilidade máxima — letras difíceis de confundir.",
	},
	"source-serif": {
		label: "Source Serif 4",
		family: '"Source Serif 4", Georgia, serif',
		category: "serif",
		note: "Serif de leitura para .md longo — sensação de documento.",
	},
} as const satisfies Record<string, FontDef>;

export type FontId = keyof typeof FONTS;

export const DEFAULT_UI_FONT: FontId = "jetbrains-mono";
export const DEFAULT_READING_FONT: FontId = "inter";
