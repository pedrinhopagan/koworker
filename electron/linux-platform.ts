export function resolveLinuxOzonePlatform(display?: string, waylandDisplay?: string) {
	if (waylandDisplay?.trim()) {
		return "wayland";
	}

	return display?.trim() ? "x11" : null;
}
