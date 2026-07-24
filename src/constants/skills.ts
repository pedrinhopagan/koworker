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

type SkillBooleanField = {
	key: string;
	label: string;
	help: string;
	default: boolean;
};

const SKILL_BOOLEAN_FIELDS: SkillBooleanField[] = [
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

export const SKILL_MODEL_VALUES = ["opus", "sonnet", "haiku", "fable"] as const;
export const SKILL_EFFORT_VALUES = ["low", "medium", "high", "xhigh", "max"] as const;
export const SKILL_MODEL_PREFERENCE_VALUES = ["smartest", "balanced", "fastest"] as const;

export type SkillMetadataOption = {
	value: string;
	label: string;
};

export type SkillMetadataField = {
	key: string;
	label: string;
	help: string;
	type: "boolean" | "string" | "number" | "enum" | "raw";
	default?: boolean;
	options?: readonly SkillMetadataOption[];
	placeholder?: string;
};

export const SKILL_METADATA_FIELDS: SkillMetadataField[] = [
	...SKILL_BOOLEAN_FIELDS.map((field) => ({
		...field,
		type: "boolean" as const,
	})),
	{
		key: "model",
		label: "Modelo",
		help: "Intenção de capacidade traduzida pela CLI que invocar a skill.",
		type: "enum",
		options: [
			{ value: "smartest", label: "Mais inteligente" },
			{ value: "balanced", label: "Intermediário" },
			{ value: "fastest", label: "Mais rápido" },
		],
	},
	{
		key: "effort",
		label: "Esforço",
		help: "Intenção de raciocínio traduzida pela CLI que invocar a skill.",
		type: "enum",
		options: [
			{ value: "high", label: "Mais inteligente" },
			{ value: "medium", label: "Intermediário" },
			{ value: "low", label: "Mais rápido" },
		],
	},
];

export const SKILL_KNOWN_METADATA_KEYS = new Set<string>([
	...SKILL_BOOLEAN_FIELDS.map((field) => field.key),
	...SKILL_METADATA_FIELDS.map((field) => field.key),
	"when_to_use",
	"argument-hint",
	"arguments",
	"allowed-tools",
	"disallowed-tools",
	"paths",
	"context",
	"agent",
	"shell",
	"license",
	"model",
	"effort",
	"icon",
	"color",
	"name",
	"title",
	"description",
]);
