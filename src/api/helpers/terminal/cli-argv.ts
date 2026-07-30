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
