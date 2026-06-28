import { SKILL_EFFORT_VALUES, SKILL_MODEL_VALUES } from "@/constants/skills";

// Sentinela do select de modelo/esforço: "herda" o padrão. Não é flag — vira frontmatter da skill ou
// sessão do agent ao montar o comando. Radix Select não aceita value vazio, então usamos um literal.
export const INVOKE_INHERIT = "inherit";

// Modos de permissão do `claude`. `bypass` é o atalho histórico (--dangerously-skip-permissions);
// os demais viram `--permission-mode <x>`. Ordem = ordem no select.
export type InvokePermissionMode = "bypass" | "plan" | "acceptEdits" | "default";

export type InvokeOption = { value: string; label: string; hint: string };

// Um value fora das opções conhecidas (ex.: ID de modelo completo herdado do frontmatter) ganha um
// item extra pra que o select reflita exatamente o que será invocado, em vez de renderizar vazio.
// Dono único da regra: os dois selects (painel e controle dedicado) passam por aqui.
export function reflectValue(options: InvokeOption[], value: string): InvokeOption[] {
	if (options.some((option) => option.value === value)) {
		return options;
	}
	return [...options, { value, label: value, hint: value }];
}

const MODEL_LABELS: Record<(typeof SKILL_MODEL_VALUES)[number], string> = {
	opus: "Opus",
	sonnet: "Sonnet",
	haiku: "Haiku",
};

const EFFORT_LABELS: Record<(typeof SKILL_EFFORT_VALUES)[number], string> = {
	low: "Baixo",
	medium: "Médio",
	high: "Alto",
	xhigh: "Extra",
	max: "Máximo",
};

export const INVOKE_MODEL_OPTIONS: InvokeOption[] = [
	{ value: INVOKE_INHERIT, label: "Modelo padrão", hint: "herda a sessão / frontmatter" },
	...SKILL_MODEL_VALUES.map((value) => ({
		value,
		label: MODEL_LABELS[value],
		hint: `--model ${value}`,
	})),
];

export const INVOKE_EFFORT_OPTIONS: InvokeOption[] = [
	{ value: INVOKE_INHERIT, label: "Esforço padrão", hint: "herda a sessão / frontmatter" },
	...SKILL_EFFORT_VALUES.map((value) => ({
		value,
		label: EFFORT_LABELS[value],
		hint: `--effort ${value}`,
	})),
];

export const INVOKE_PERMISSION_OPTIONS: {
	value: InvokePermissionMode;
	label: string;
	hint: string;
}[] = [
	{ value: "bypass", label: "Auto", hint: "--dangerously-skip-permissions" },
	{ value: "plan", label: "Plano", hint: "--permission-mode plan" },
	{ value: "acceptEdits", label: "Aceitar edits", hint: "--permission-mode acceptEdits" },
	{ value: "default", label: "Perguntar", hint: "--permission-mode default" },
];
