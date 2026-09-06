import { buildClaudeArgv } from "@/lib/claude-command";
import { buildCodexArgv } from "@/lib/codex-command";
import type { WorkingCli } from "@/constants/invoke";

export type TerminalCli = "claude" | "codex";

export type CliStartParams = {
	cli: TerminalCli;
	prompt?: string;
	model?: string;
	effort?: string;
	agent?: string;
	permissionMode?: "bypass" | "plan" | "acceptEdits" | "default";
	approvalMode?: "bypass" | "fullAuto" | "readOnly" | "default";
};

export function cliStartWithFullAccessArgv(cli: WorkingCli): string[] {
	if (cli === "codex") {
		return ["codex", "--yolo"];
	}
	if (cli === "pi") {
		return ["pi"];
	}

	return ["claude", "--dangerously-skip-permissions"];
}

export function cliStartArgv(params: CliStartParams): string[] {
	const argv =
		params.cli === "codex"
			? buildCodexArgv({
					prompt: params.prompt ?? "",
					approvalMode: params.approvalMode ?? "default",
					...(params.model ? { model: params.model } : {}),
					...(params.effort ? { effort: params.effort } : {}),
				})
			: buildClaudeArgv({
					prompt: params.prompt ?? "",
					permissionMode: params.permissionMode ?? "default",
					...(params.agent ? { agent: params.agent } : {}),
					...(params.model ? { model: params.model } : {}),
					...(params.effort ? { effort: params.effort } : {}),
				});

	return argv.filter((arg) => arg !== "");
}

// CLI subindo numa tab restaurada, retomando a conversa de antes. Sem o id da sessão (o agent subiu
// sem reportar ao daemon) cada CLI tem o seu jeito de dizer "a última daqui": `--continue` no claude e
// `resume --last` no codex, ambos resolvidos pelo cwd da tab. Argv à mão porque os builders só montam
// `--resume` no caminho headless, e aqui o CLI sobe interativo.
export function cliResumeArgv(cli: TerminalCli): string[] {
	if (cli === "codex") {
		return ["codex", "resume", "--last"];
	}

	return ["claude", "--continue"];
}

export type CliResumeOptions = {
	model?: string;
	effort?: string;
	// Sessão nascida do PWA sobe sem menu de permissão (ele não entra no transcript, então no celular
	// seria um beco sem saída); a reabertura por troca de modelo herda isso.
	fullAccess?: boolean;
};

// Uma conversa antiga escolhida no histórico, retomada pelo id que o próprio CLI gravou no
// transcript. Vale para as duas CLIs porque as duas resolvem a sessão pelo id, e não pela ordem em
// que ela foi encerrada — o pane sobe exatamente naquela conversa. Modelo e esforço entram quando a
// retomada é a troca de modelo de uma sessão viva: `/model` do claude persiste como padrão global e o
// codex não troca por texto, então as duas reabrem com flags.
export function cliResumeByIdArgv(
	cli: TerminalCli,
	sessionId: string,
	options: CliResumeOptions = {},
): string[] {
	if (cli === "codex") {
		return [
			"codex",
			"resume",
			...(options.fullAccess ? ["--dangerously-bypass-approvals-and-sandbox"] : []),
			...(options.model ? ["-m", options.model] : []),
			...(options.effort ? ["-c", `model_reasoning_effort=${options.effort}`] : []),
			sessionId,
		];
	}

	return [
		"claude",
		"--resume",
		sessionId,
		...(options.fullAccess ? ["--dangerously-skip-permissions"] : []),
		...(options.model ? ["--model", options.model] : []),
		...(options.effort ? ["--effort", options.effort] : []),
	];
}
