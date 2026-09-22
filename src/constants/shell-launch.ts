export const SHELL_LAUNCH_OPTIONS = [
	{ id: "shell", label: "Terminal", hint: "Prompt livre para qualquer comando" },
	{ id: "claude", label: "Claude Code", hint: "Chat na mesma sessão do terminal" },
	{ id: "codex", label: "Codex", hint: "Usa a conta do comando codex" },
	{ id: "codex-personal", label: "Codex pessoal", hint: "Usa o comando codex-personal" },
] as const;

export type ShellLaunchCommand = (typeof SHELL_LAUNCH_OPTIONS)[number]["id"];
