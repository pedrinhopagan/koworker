import { buildClaudeArgv } from "@/lib/claude-command";
import { buildCodexArgv } from "@/lib/codex-command";

export type TerminalCli = "claude" | "codex";

export type CliStartParams = {
	cli: TerminalCli;
	prompt?: string;
	model?: string;
	effort?: string;
	agent?: string;
	permissionMode?: "plan" | "acceptEdits" | "default";
	approvalMode?: "fullAuto" | "readOnly" | "default";
};

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

// Uma conversa antiga escolhida no histórico, retomada pelo id que o próprio CLI gravou no
// transcript. Vale para as duas CLIs porque as duas resolvem a sessão pelo id, e não pela ordem em
// que ela foi encerrada — o pane sobe exatamente naquela conversa.
export function cliResumeByIdArgv(cli: TerminalCli, sessionId: string): string[] {
	if (cli === "codex") {
		return ["codex", "resume", sessionId];
	}

	return ["claude", "--resume", sessionId];
}
