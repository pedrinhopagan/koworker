export function legacyTerminalRedirect(paneId?: string) {
	return paneId
		? { to: "/chat" as const, search: { paneId }, replace: true as const }
		: { to: "/chat" as const, replace: true as const };
}
