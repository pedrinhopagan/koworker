// Monta o comando `claude` de uma invocação. Ponto único de verdade: o preview ao vivo no prompt-bar
// e a execução real no backend (send-keys no tmux ou spawn no modo none) chamam esta mesma função —
// antes eram duas implementações espelhadas (Rust do terminal + front). `permissionMode` "bypass" vira
// o atalho histórico `--dangerously-skip-permissions`; os demais viram `--permission-mode <x>` (os
// dois flags são mutuamente exclusivos no `claude`).
export type ClaudeCommandParams = {
	prompt: string;
	permissionMode: string;
	agent?: string;
	model?: string;
	effort?: string;
};

export function buildClaudeCommand({
	prompt,
	permissionMode,
	agent,
	model,
	effort,
}: ClaudeCommandParams): string {
	const flags =
		permissionMode === "bypass"
			? ["--dangerously-skip-permissions"]
			: [`--permission-mode ${permissionMode}`];

	if (agent) {
		flags.push(`--agent ${agent}`);
	}
	if (model) {
		flags.push(`--model ${model}`);
	}
	if (effort) {
		flags.push(`--effort ${effort}`);
	}

	return `claude ${flags.join(" ")} "${shellEscape(prompt)}"`;
}

// Escapa o prompt pra caber entre aspas duplas num comando de shell sem expandir `$`/crase — o mesmo
// escape que o backend aplica antes de embutir o prompt, então o preview bate 1:1 com o comando real.
// Compartilhado com o comando `codex`.
export function shellEscape(value: string): string {
	return value
		.replaceAll("\\", "\\\\")
		.replaceAll('"', '\\"')
		.replaceAll("$", "\\$")
		.replaceAll("`", "\\`");
}
