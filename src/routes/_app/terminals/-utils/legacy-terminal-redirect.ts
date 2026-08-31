export function legacyTerminalRedirect(paneId?: string) {
	return paneId
		? { to: "/shells" as const, search: { tab: `agent:${paneId}` }, replace: true as const }
		: { to: "/shells" as const, replace: true as const };
}
