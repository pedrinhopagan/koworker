export function agentPromptInput(agent: string, text: string) {
	if (agent === "claude") {
		return text.replaceAll("\t", "    ").replaceAll("\n", "\u001B[13;2u");
	}

	return `\u001B[200~${text}\u001B[201~`;
}
