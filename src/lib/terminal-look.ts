export const TERMINAL_FONT_FAMILY =
	'"Noto Sans Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

export const TERMINAL_FONT_SIZE = 16;

export function resolveTerminalTheme(host: HTMLElement) {
	const style = getComputedStyle(host);
	return {
		background: style.getPropertyValue("--background").trim(),
		foreground: style.getPropertyValue("--foreground").trim(),
		cursor: style.getPropertyValue("--primary").trim(),
		cursorAccent: style.getPropertyValue("--primary-foreground").trim(),
		selectionBackground: style.getPropertyValue("--accent").trim(),
	};
}
