// Comandos de barra que cada CLI interpreta sozinha: o koworker só os despacha como texto pelo
// `agentRadar.send`, então basta conhecer o nome. `keywords` cobre o comando que a outra CLI usa
// para a mesma coisa (quem vem do codex digita `/new` no claude) e o vocabulário em pt-BR.
export type CliCommand = {
	name: string;
	description: string;
	keywords?: string[];
};

const CLAUDE_COMMANDS: CliCommand[] = [
	{
		name: "add-dir",
		description: "Adiciona outro diretório ao contexto de trabalho",
	},
	{ name: "agents", description: "Gerencia os subagents disponíveis" },
	{
		name: "bashes",
		description: "Lista e controla os shells em segundo plano",
	},
	{
		name: "clear",
		description: "Começa uma conversa nova e apaga o histórico",
		keywords: ["new", "nova", "limpar", "reset", "zerar"],
	},
	{
		name: "compact",
		description: "Resume a conversa e libera contexto",
		keywords: ["resumir", "comprimir"],
	},
	{
		name: "config",
		description: "Abre as configurações da CLI",
		keywords: ["configuração"],
	},
	{ name: "context", description: "Mostra quanto do contexto já foi usado" },
	{
		name: "cost",
		description: "Mostra o custo da sessão",
		keywords: ["custo", "gasto"],
	},
	{ name: "doctor", description: "Diagnostica a instalação da CLI" },
	{ name: "exit", description: "Encerra a CLI", keywords: ["sair", "quit"] },
	{
		name: "export",
		description: "Exporta a conversa atual",
		keywords: ["exportar"],
	},
	{
		name: "help",
		description: "Lista os comandos disponíveis",
		keywords: ["ajuda"],
	},
	{ name: "hooks", description: "Configura os hooks de eventos" },
	{
		name: "init",
		description: "Cria o CLAUDE.md do projeto",
		keywords: ["iniciar"],
	},
	{
		name: "install-github-app",
		description: "Instala o app do GitHub para revisar PRs",
	},
	{
		name: "login",
		description: "Troca a conta autenticada",
		keywords: ["entrar"],
	},
	{
		name: "logout",
		description: "Sai da conta autenticada",
		keywords: ["sair"],
	},
	{ name: "mcp", description: "Gerencia os servidores MCP" },
	{
		name: "memory",
		description: "Edita os arquivos de memória",
		keywords: ["memória"],
	},
	{
		name: "model",
		description: "Troca o modelo da sessão",
		keywords: ["modelo"],
	},
	{ name: "output-style", description: "Troca o estilo das respostas" },
	{
		name: "permissions",
		description: "Edita as permissões de ferramenta",
		keywords: ["permissões"],
	},
	{ name: "pr-comments", description: "Lê os comentários de uma pull request" },
	{ name: "privacy-settings", description: "Abre as opções de privacidade" },
	{ name: "release-notes", description: "Mostra as novidades da versão" },
	{
		name: "resume",
		description: "Retoma uma conversa anterior",
		keywords: ["retomar", "continuar", "histórico"],
	},
	{
		name: "review",
		description: "Revisa uma pull request",
		keywords: ["revisar"],
	},
	{
		name: "rewind",
		description: "Volta a conversa a um ponto anterior",
		keywords: ["voltar", "desfazer", "undo"],
	},
	{ name: "status", description: "Mostra conta, modelo e conexões" },
	{ name: "statusline", description: "Configura a linha de status" },
	{
		name: "terminal-setup",
		description: "Ajusta o terminal para a quebra de linha",
	},
	{ name: "todos", description: "Mostra a lista de tarefas do agente" },
	{ name: "upgrade", description: "Mostra os planos disponíveis" },
	{
		name: "usage",
		description: "Mostra os limites de uso do plano",
		keywords: ["limite", "uso"],
	},
	{ name: "vim", description: "Alterna o modo de edição vim" },
];

const CODEX_COMMANDS: CliCommand[] = [
	{
		name: "new",
		description: "Começa uma conversa nova",
		keywords: ["clear", "nova", "limpar", "reset", "zerar"],
	},
	{
		name: "init",
		description: "Cria o AGENTS.md do projeto",
		keywords: ["iniciar"],
	},
	{
		name: "compact",
		description: "Resume a conversa e libera contexto",
		keywords: ["resumir", "comprimir"],
	},
	{
		name: "review",
		description: "Pede uma revisão do código",
		keywords: ["revisar"],
	},
	{
		name: "undo",
		description: "Desfaz a última alteração do agente",
		keywords: ["desfazer", "voltar", "rewind"],
	},
	{
		name: "diff",
		description: "Mostra o diff do que mudou",
		keywords: ["mudanças", "git"],
	},
	{
		name: "mention",
		description: "Insere a menção a um arquivo",
		keywords: ["arquivo"],
	},
	{ name: "status", description: "Mostra a sessão, o modelo e o uso" },
	{
		name: "model",
		description: "Troca o modelo e o esforço",
		keywords: ["modelo", "effort"],
	},
	{
		name: "approvals",
		description: "Troca a política de aprovação",
		keywords: ["aprovação", "permissões"],
	},
	{ name: "mcp", description: "Lista os servidores MCP" },
	{
		name: "logout",
		description: "Sai da conta autenticada",
		keywords: ["sair"],
	},
	{ name: "quit", description: "Encerra a CLI", keywords: ["sair", "exit"] },
];

const CLI_COMMANDS: Record<string, CliCommand[]> = {
	claude: CLAUDE_COMMANDS,
	"claude-code": CLAUDE_COMMANDS,
	codex: CODEX_COMMANDS,
};

export function cliCommands(cli?: string) {
	if (!cli) return [];

	return CLI_COMMANDS[cli] ?? [];
}
