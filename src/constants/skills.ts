import type { SkillSource } from "@/types/skills";

export const SKILL_TOOL_LABEL: Record<SkillSource["tool"], string> = {
	opencode: "opencode",
	"claude-code": "Claude Code",
	codex: "Codex",
	agents: "Agents",
	koworker: "Koworker",
};

// Agents que o usuário pode cadastrar um caminho custom (koworker fica de fora: é o static interno).
export const SKILL_TOOLS: SkillSource["tool"][] = ["opencode", "claude-code", "codex", "agents"];

// Metadados booleanos que o Claude Code reconhece no frontmatter da skill. Viram switches no
// cabeçalho: o valor escrito no arquivo é sempre `true`/`false` explícito. `default` é o que o
// Claude Code assume quando a chave está ausente — usado pra refletir o estado real sem gravar.
export type SkillBooleanField = {
	key: string;
	label: string;
	help: string;
	default: boolean;
};

export const SKILL_BOOLEAN_FIELDS: SkillBooleanField[] = [
	{
		key: "disable-model-invocation",
		label: "Só por chamada explícita",
		help: "Ligado: o agente não usa a skill sozinho — só você, chamando /slug. Também não entra em subagents.",
		default: false,
	},
	{
		key: "user-invocable",
		label: "Aparece no menu /",
		help: "Desligado: some do menu de barra; só o agente usa (skill de conhecimento de fundo).",
		default: true,
	},
];

// Demais metadados conhecidos do Claude Code. `help` é o mini-guia (info no hover); `options`, quando
// presente, troca o campo de texto por um radio de escolha única. Listas (`allowed-tools`, `paths`, …)
// são aceitas como string separada por vírgula pelo próprio agente.
export type SkillStringField = {
	key: string;
	label: string;
	placeholder: string;
	help: string;
	// Radio de valores fixos. `clearOn` é o valor que representa "padrão/herdar" e, ao ser escolhido,
	// limpa a chave do arquivo (mantém o frontmatter enxuto, igual ao toggle dos booleanos).
	options?: string[];
	clearOn?: string;
};

export const SKILL_STRING_FIELDS: SkillStringField[] = [
	{
		key: "model",
		label: "Modelo",
		placeholder: "inherit · opus · sonnet · haiku",
		help: "Modelo que roda a skill. Aceita os mesmos valores do /model (aliases ou ID completo); 'inherit' mantém o modelo da sessão.",
		options: ["inherit", "opus", "sonnet", "haiku"],
		clearOn: "inherit",
	},
	{
		key: "effort",
		label: "Esforço",
		placeholder: "low · medium · high · xhigh · max",
		help: "Nível de raciocínio do modelo ao executar a skill. Os níveis disponíveis dependem do modelo. Em branco herda o esforço da sessão.",
		options: ["low", "medium", "high", "xhigh", "max"],
	},
	{
		key: "when_to_use",
		label: "Quando usar",
		placeholder: "frases de gatilho extras",
		help: "Frases de gatilho extras que ajudam o agente a decidir quando acionar a skill sozinho.",
	},
	{
		key: "argument-hint",
		label: "Dica de argumentos",
		placeholder: "[issue] [formato]",
		help: "Dica mostrada no menu / sobre quais argumentos a skill espera.",
	},
	{
		key: "arguments",
		label: "Argumentos",
		placeholder: "nome1 nome2",
		help: "Nomes dos argumentos posicionais que a skill recebe ao ser chamada.",
	},
	{
		key: "allowed-tools",
		label: "Ferramentas liberadas",
		placeholder: "Bash, Read, Edit",
		help: "Restringe a skill a apenas estas ferramentas (lista separada por vírgula).",
	},
	{
		key: "disallowed-tools",
		label: "Ferramentas bloqueadas",
		placeholder: "WebFetch",
		help: "Bloqueia estas ferramentas enquanto a skill roda (lista separada por vírgula).",
	},
	{
		key: "paths",
		label: "Globs de ativação",
		placeholder: "src/**/*.ts",
		help: "Globs de arquivos que sugerem a skill automaticamente quando casam com o contexto.",
	},
	{
		key: "context",
		label: "Contexto",
		placeholder: "fork",
		help: "Como o contexto é tratado ao rodar a skill (ex.: 'fork' executa num contexto separado).",
	},
	{
		key: "agent",
		label: "Subagent",
		placeholder: "Explore · Plan",
		help: "Subagent que executa a skill no lugar do agente principal.",
	},
	{
		key: "shell",
		label: "Shell",
		placeholder: "bash · powershell",
		help: "Shell usado pelos comandos da skill.",
	},
	{
		key: "license",
		label: "Licença",
		placeholder: "MIT",
		help: "Licença declarada da skill.",
	},
];

export const SKILL_KNOWN_METADATA_KEYS = new Set<string>([
	...SKILL_BOOLEAN_FIELDS.map((field) => field.key),
	...SKILL_STRING_FIELDS.map((field) => field.key),
	// Já editados em outros lugares (aparência) — fora do editor de metadados.
	"icon",
	"color",
	"name",
	"title",
	"description",
]);
