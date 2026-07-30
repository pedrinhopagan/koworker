import { buildClaudeArgv } from "@/lib/claude-command";
import { buildCodexArgv } from "@/lib/codex-command";

export type TerminalCli = "claude" | "codex";

// CLI interativo subindo numa tab: mesmos flags de permissão da invocação (bypass). Sem prompt o
// argumento final sai do argv, senão o CLI abriria com uma linha vazia como primeira mensagem.
export function cliStartArgv(cli: TerminalCli, prompt = ""): string[] {
	const argv =
		cli === "codex"
			? buildCodexArgv({ prompt, approvalMode: "bypass" })
			: buildClaudeArgv({ prompt, permissionMode: "bypass" });

	return argv.filter((arg) => arg !== "");
}

// CLI subindo numa tab restaurada, retomando a conversa de antes. Sem o id da sessão (o agent subiu
// sem reportar ao daemon) cada CLI tem o seu jeito de dizer "a última daqui": `--continue` no claude e
// `resume --last` no codex, ambos resolvidos pelo cwd da tab. Argv à mão porque os builders só montam
// `--resume` no caminho headless, e aqui o CLI sobe interativo.
export function cliResumeArgv(cli: TerminalCli, sessionId?: string | null): string[] {
	if (cli === "codex") {
		return ["codex", "resume", sessionId || "--last", "--dangerously-bypass-approvals-and-sandbox"];
	}

	return [
		"claude",
		"--dangerously-skip-permissions",
		...(sessionId ? ["--resume", sessionId] : ["--continue"]),
	];
}
