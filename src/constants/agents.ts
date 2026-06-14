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

// Metadados de texto do frontmatter do agent. `help` é o mini-guia (info no hover); `options`, quando
// presente, troca o campo de texto por um radio de escolha única. Listas (`tools`) são aceitas como
// string separada por vírgula pelo próprio agente.
export type AgentStringField = {
	key: string;
	label: string;
	placeholder: string;
	help: string;
	// Radio de valores fixos. `clearOn` é o valor que representa "padrão/herdar" e, ao ser escolhido,
	// limpa a chave do arquivo (mantém o frontmatter enxuto).
	options?: string[];
	clearOn?: string;
};

export const AGENT_STRING_FIELDS: AgentStringField[] = [
	{
		key: "tools",
		label: "Ferramentas",
		placeholder: "Bash, Read, Edit",
		help: "Ferramentas que o agent pode usar (lista separada por vírgula). Em branco, herda todas — fronteira implícita.",
	},
	{
		key: "model",
		label: "Modelo",
		placeholder: "inherit · opus · sonnet · haiku",
		help: "Modelo que roda o agent. Aceita os mesmos valores do /model (aliases ou ID completo); 'inherit' mantém o modelo da sessão.",
		options: ["inherit", "opus", "sonnet", "haiku"],
		clearOn: "inherit",
	},
];

export const AGENT_KNOWN_METADATA_KEYS = new Set<string>([
	...AGENT_BOOLEAN_FIELDS.map((field) => field.key),
	...AGENT_STRING_FIELDS.map((field) => field.key),
	// Já editados em outros lugares (aparência) — fora do editor de metadados.
	"icon",
	"color",
	"name",
	"title",
	"description",
]);
