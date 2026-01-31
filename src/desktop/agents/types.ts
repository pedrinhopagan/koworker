export const idsAgent = ["claude", "opencode", "codex"] as const;

export type AgentId = (typeof idsAgent)[number];

export type AgentModelConfig =
	| { kind: "flag"; flag: string }
	| { kind: "env"; envVar: string }
	| { kind: "none" };

export type AgentPromptConfig =
	| { kind: "arg"; flag?: string }
	| { kind: "stdin" };

export type Agent = {
	id: AgentId;
	nome: string;
	/** Binário principal (ex: `claude`, `opencode`, `codex`) */
	cmd: string;
	/** Args fixos sempre presentes */
	argsBase: string[];
	model: AgentModelConfig;
	prompt: AgentPromptConfig;
	observacoes?: string[];
};

export type BuildAgentCommandInput = {
	agentId: AgentId;
	/** Modelo (ex: `anthropic/claude-opus-4-5`, `openai/gpt-5.1-codex`). */
	model?: string;
	/** Prompt principal do agente */
	prompt: string;
	/** Diretório de trabalho (não é incluído no retorno; o caller deve setar no spawn). */
	cwd?: string;
	/** Args adicionais, se necessário (MVP) */
	extraArgs?: string[];
};

export type BuiltAgentCommand = {
	cmd: string;
	args: string[];
	/** Quando presente, o caller deve escrever isso no stdin do processo */
	stdin?: string;
};
