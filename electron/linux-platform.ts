export function resolveLinuxOzonePlatform(display?: string) {
	return display?.trim() ? "x11" : null;
}
