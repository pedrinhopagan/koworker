import { shellEscape } from "@/lib/claude-command";

// Monta o comando `codex` de uma invocação — o irmão de buildClaudeCommand, mesmo contrato: o preview
// ao vivo no prompt-bar e a execução real no backend chamam esta mesma função. `approvalMode` traduz
// pros flags de aprovação/sandbox do codex; `default` (ou valor desconhecido) não emite flag.
export type CodexCommandParams = {
	prompt: string;
	approvalMode: string;
	model?: string;
	effort?: string;
};

export function buildCodexCommand({
	prompt,
	approvalMode,
	model,
	effort,
}: CodexCommandParams): string {
	const flags: string[] = [];

	if (approvalMode === "bypass") {
		flags.push("--dangerously-bypass-approvals-and-sandbox");
	} else if (approvalMode === "fullAuto") {
		flags.push("--full-auto");
	} else if (approvalMode === "readOnly") {
		flags.push("--sandbox read-only");
	}

	if (model) {
		flags.push(`-m ${model}`);
	}
	if (effort) {
		flags.push(`-c model_reasoning_effort=${effort}`);
	}

	return ["codex", ...flags, `"${shellEscape(prompt)}"`].join(" ");
}
