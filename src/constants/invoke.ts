import {
	SKILL_EFFORT_VALUES,
	SKILL_MODEL_PREFERENCE_VALUES,
	SKILL_MODEL_VALUES,
} from "@/constants/skills";

// Sentinela do select de modelo/esforço: "herda" o padrão. Não é flag — vira frontmatter da skill ou
// sessão do agent ao montar o comando. Radix Select não aceita value vazio, então usamos um literal.
export const INVOKE_INHERIT = "inherit";

export function withoutInvokeInherit(value: string) {
	return value === INVOKE_INHERIT ? undefined : value;
}

// CLI de trabalho da sessão: governa o comando montado (claude vs codex), os knobs de sessão exibidos
// e a grafia das skills no prompt (`/slug` no claude, `$slug` no codex).
export const INVOKE_CLIS = ["claude", "codex"] as const;

export type InvokeCli = (typeof INVOKE_CLIS)[number];

export const INVOKE_CLI_OPTIONS: {
	value: InvokeCli;
	label: string;
	hint: string;
}[] = [
	{
		value: "claude",
		label: "Claude",
		hint: "sessões `claude` — skills invocadas com /",
	},
	{
		value: "codex",
		label: "Codex",
		hint: "sessões `codex` — skills convertidas para $",
	},
];

// Modos de permissão do `claude`. `bypass` é o atalho histórico (--dangerously-skip-permissions);
// os demais viram `--permission-mode <x>`. Ordem = ordem no select.
export type InvokePermissionMode = "bypass" | "plan" | "acceptEdits" | "default";

export type InvokeOption = { value: string; label: string; hint: string };

const SKILL_MODEL_BY_CLI: Record<
	InvokeCli,
	Record<(typeof SKILL_MODEL_PREFERENCE_VALUES)[number], string>
> = {
	claude: {
		smartest: "opus",
		balanced: "sonnet",
		fastest: "haiku",
	},
	codex: {
		smartest: "gpt-5.6-sol",
		balanced: "gpt-5.6-terra",
		fastest: "gpt-5.6-luna",
	},
};

export function normalizeCodexModel(value: string) {
	return value === "gpt-5.6" ? "gpt-5.6-sol" : value;
}

export function resolveSkillModelPreference(value: unknown, cli: InvokeCli) {
	if (typeof value !== "string" || !value.trim()) {
		return INVOKE_INHERIT;
	}

	const normalized = value.trim();
	switch (normalized) {
		case "smartest":
		case "balanced":
		case "fastest":
			return SKILL_MODEL_BY_CLI[cli][normalized];
	}

	return normalized;
}

export function resolveSkillEffortPreference(value: unknown, cli: InvokeCli) {
	if (typeof value !== "string" || !value.trim()) {
		return INVOKE_INHERIT;
	}

	const normalized = value.trim();
	if (cli === "codex" && normalized === "max") {
		return "xhigh";
	}

	return normalized;
}

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
	fable: "Fable",
};

const EFFORT_LABELS: Record<(typeof SKILL_EFFORT_VALUES)[number], string> = {
	low: "Baixo",
	medium: "Médio",
	high: "Alto",
	xhigh: "Extra",
	max: "Máximo",
};

export const INVOKE_MODEL_OPTIONS: InvokeOption[] = [
	{
		value: INVOKE_INHERIT,
		label: "Modelo padrão",
		hint: "herda a sessão / frontmatter",
	},
	...SKILL_MODEL_VALUES.map((value) => ({
		value,
		label: MODEL_LABELS[value],
		hint: `--model ${value}`,
	})),
];

export const INVOKE_EFFORT_OPTIONS: InvokeOption[] = [
	{
		value: INVOKE_INHERIT,
		label: "Esforço padrão",
		hint: "herda a sessão / frontmatter",
	},
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
	{
		value: "acceptEdits",
		label: "Aceitar edits",
		hint: "--permission-mode acceptEdits",
	},
	{ value: "default", label: "Perguntar", hint: "--permission-mode default" },
];

// Aprovação/sandbox do `codex` — o equivalente funcional do permission mode do claude, com os flags
// próprios do codex. Ordem = ordem no select.
export const CODEX_APPROVAL_MODES = ["bypass", "fullAuto", "readOnly", "default"] as const;

export type CodexApprovalMode = (typeof CODEX_APPROVAL_MODES)[number];

export const CODEX_APPROVAL_OPTIONS: {
	value: CodexApprovalMode;
	label: string;
	hint: string;
}[] = [
	{
		value: "bypass",
		label: "Auto",
		hint: "--dangerously-bypass-approvals-and-sandbox",
	},
	{ value: "fullAuto", label: "Full auto", hint: "--full-auto" },
	{ value: "readOnly", label: "Só leitura", hint: "--sandbox read-only" },
	{ value: "default", label: "Perguntar", hint: "aprovações padrão do codex" },
];

export const CODEX_DELEGATE_DEFAULTS = {
	model: "gpt-5.6-sol",
	effort: "medium",
} as const;

export const CODEX_MODEL_OPTIONS: InvokeOption[] = [
	{
		value: INVOKE_INHERIT,
		label: "Modelo padrão",
		hint: "herda a config do codex",
	},
	{ value: "gpt-5.6-sol", label: "GPT-5.6 Sol", hint: "-m gpt-5.6-sol" },
	{ value: "gpt-5.6-terra", label: "GPT-5.6 Terra", hint: "-m gpt-5.6-terra" },
	{ value: "gpt-5.6-luna", label: "GPT-5.6 Lua", hint: "-m gpt-5.6-luna" },
	{ value: "gpt-5.5", label: "GPT-5.5", hint: "-m gpt-5.5" },
	{ value: "gpt-5.5-codex", label: "GPT-5.5 Codex", hint: "-m gpt-5.5-codex" },
];

export const CODEX_EFFORT_OPTIONS: InvokeOption[] = [
	{
		value: INVOKE_INHERIT,
		label: "Esforço padrão",
		hint: "herda a config do codex",
	},
	...(["low", "medium", "high", "xhigh"] as const).map((value) => ({
		value,
		label: EFFORT_LABELS[value],
		hint: `-c model_reasoning_effort=${value}`,
	})),
];
