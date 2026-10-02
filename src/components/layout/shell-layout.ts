export type AgentDockMode = "launcher" | "dock" | "overlay";

export function resolveAgentDockMode({
	expanded,
	terminalOnScreen,
}: {
	expanded: boolean;
	terminalOnScreen: boolean;
}): AgentDockMode {
	if (!expanded) {
		return "launcher";
	}

	return terminalOnScreen ? "overlay" : "dock";
}
