export const TERMINAL_FONT_FAMILY =
	'"Noto Sans Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

export const TERMINAL_FONT_SIZE = 16;

export function resolveTerminalTheme(host: HTMLElement) {
	const style = getComputedStyle(host);
	const scrollbar = style.getPropertyValue("--terminal-scrollbar").trim();
	const scrollbarHover = style.getPropertyValue("--terminal-scrollbar-hover").trim();

	return {
		background:
			style.getPropertyValue("--terminal-background").trim() ||
			style.getPropertyValue("--background").trim(),
		foreground:
			style.getPropertyValue("--terminal-foreground").trim() ||
			style.getPropertyValue("--foreground").trim(),
		cursor:
			style.getPropertyValue("--terminal-cursor").trim() ||
			style.getPropertyValue("--primary").trim(),
		cursorAccent:
			style.getPropertyValue("--terminal-cursor-accent").trim() ||
			style.getPropertyValue("--primary-foreground").trim(),
		selectionBackground:
			style.getPropertyValue("--terminal-selection").trim() ||
			style.getPropertyValue("--accent").trim(),
		...(scrollbar && { scrollbarSliderBackground: scrollbar }),
		...(scrollbarHover && {
			scrollbarSliderHoverBackground: scrollbarHover,
			scrollbarSliderActiveBackground: scrollbarHover,
		}),
	};
}
