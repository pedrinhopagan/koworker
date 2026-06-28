import type { AgentSource } from "@/types/agents";

export const AGENT_TOOL_LABEL: Record<AgentSource["tool"], string> = {
	opencode: "opencode",
	"claude-code": "Claude Code",
	codex: "Codex",
	koworker: "Koworker",
};

// Agents que o usuário pode cadastrar um caminho custom (koworker fica de fora: é o static interno).
export const AGENT_TOOLS: AgentSource["tool"][] = ["claude-code", "opencode", "codex"];

// Metadados booleanos reconhecidos no frontmatter do agent. Agents não têm condicionais de invocação
// próprias hoje; o array fica vazio (a UI cai só nos campos de texto e nos extras genéricos).
export type AgentBooleanField = {
	key: string;
	label: string;
	help: string;
	default: boolean;
};

export const AGENT_BOOLEAN_FIELDS: AgentBooleanField[] = [];

// Metadados de texto do frontmatter do agent. `help` é o mini-guia (info no hover). Listas (`tools`)
// são aceitas como string separada por vírgula pelo próprio agente. `model`/`effort` ficam fora daqui:
// são editados no controle dedicado de padrões (cabeçalho), não no popover genérico.
export type AgentStringField = {
	key: string;
	label: string;
	placeholder: string;
	help: string;
};

export const AGENT_STRING_FIELDS: AgentStringField[] = [
	{
		key: "tools",
		label: "Ferramentas",
		placeholder: "Bash, Read, Edit",
		help: "Ferramentas que o agent pode usar (lista separada por vírgula). Em branco, herda todas — fronteira implícita.",
	},
];

export const AGENT_KNOWN_METADATA_KEYS = new Set<string>([
	...AGENT_BOOLEAN_FIELDS.map((field) => field.key),
	...AGENT_STRING_FIELDS.map((field) => field.key),
	// Editados no controle dedicado de padrões (cabeçalho), fora do popover genérico.
	"model",
	"effort",
	// Já editados em outros lugares (aparência) — fora do editor de metadados.
	"icon",
	"color",
	"name",
	"title",
	"description",
]);
