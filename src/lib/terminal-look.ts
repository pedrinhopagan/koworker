// A mesma cara do alacritty e do kw-terminal desta máquina: o fontconfig resolve
// `monospace` para Noto Sans Mono, e o size 12 do alacritty (pt, scale 1) equivale
// a 16px no xterm. As cores saem das vars do tema: o renderer DOM do xterm aplica
// os valores como style, então claro/escuro acompanham o app sem paleta duplicada.
export const TERMINAL_FONT_FAMILY =
	'"Noto Sans Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

export const TERMINAL_FONT_SIZE = 16;

export const TERMINAL_THEME = {
	background: "var(--background)",
	foreground: "var(--foreground)",
	cursor: "var(--primary)",
	cursorAccent: "var(--primary-foreground)",
	selectionBackground: "var(--accent)",
};
