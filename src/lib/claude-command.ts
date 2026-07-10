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
	headless?: boolean;
};

function permissionArgs(permissionMode: string) {
	return permissionMode === "bypass"
		? ["--dangerously-skip-permissions"]
		: ["--permission-mode", permissionMode];
}

export function buildClaudePrintArgs(params: ClaudeCommandParams) {
	const args = ["claude", "-p", ...permissionArgs(params.permissionMode)];
	if (params.agent) {
		args.push("--agent", params.agent);
	}
	if (params.model) {
		args.push("--model", params.model);
	}
	if (params.effort) {
		args.push("--effort", params.effort);
	}
	args.push(params.prompt);
	return args;
}

export function buildClaudeCommand(params: ClaudeCommandParams): string {
	if (params.headless) {
		const args = buildClaudePrintArgs(params);
		const prompt = args.pop() ?? "";
		return [...args, `"${shellEscape(prompt)}"`].join(" ");
	}

	const flags =
		params.permissionMode === "bypass"
			? ["--dangerously-skip-permissions"]
			: [`--permission-mode ${params.permissionMode}`];

	if (params.agent) {
		flags.push(`--agent ${params.agent}`);
	}
	if (params.model) {
		flags.push(`--model ${params.model}`);
	}
	if (params.effort) {
		flags.push(`--effort ${params.effort}`);
	}

	return `claude ${flags.join(" ")} "${shellEscape(params.prompt)}"`;
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
