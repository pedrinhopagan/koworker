import { shellEscape } from "@/lib/claude-command";

// Monta o comando `codex` de uma invocação — o irmão de buildClaudeCommand, mesmo contrato: o preview
// ao vivo no prompt-bar e a execução real no backend chamam esta mesma função. `approvalMode` traduz
// pros flags de aprovação/sandbox do codex; `default` (ou valor desconhecido) não emite flag.
export type CodexCommandParams = {
	prompt: string;
	approvalMode: string;
	model?: string;
	effort?: string;
	headless?: boolean;
};

function approvalArgs(approvalMode: string) {
	if (approvalMode === "bypass") {
		return ["--dangerously-bypass-approvals-and-sandbox"];
	}
	if (approvalMode === "fullAuto") {
		return ["--full-auto"];
	}
	if (approvalMode === "readOnly") {
		return ["--sandbox", "read-only"];
	}
	return [];
}

export function buildCodexExecArgs(params: CodexCommandParams & { cwd?: string }) {
	const args = ["codex", "exec"];

	if (params.model) {
		args.push("-m", params.model);
	}
	if (params.effort) {
		args.push("-c", `model_reasoning_effort=${params.effort}`);
	}

	args.push("--ephemeral", "--skip-git-repo-check");
	if (params.cwd) {
		args.push("-C", params.cwd);
	}
	args.push(...approvalArgs(params.approvalMode), params.prompt);
	return args;
}

export function buildCodexCommand(params: CodexCommandParams): string {
	if (params.headless) {
		const args = buildCodexExecArgs(params);
		const prompt = args.pop() ?? "";
		return [...args, `"${shellEscape(prompt)}"`].join(" ");
	}

	const flags = approvalArgs(params.approvalMode);
	if (params.model) {
		flags.push("-m", params.model);
	}
	if (params.effort) {
		flags.push("-c", `model_reasoning_effort=${params.effort}`);
	}

	return ["codex", ...flags, `"${shellEscape(params.prompt)}"`].join(" ");
}
