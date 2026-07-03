import { SKILL_EFFORT_VALUES, SKILL_MODEL_VALUES } from "@/constants/skills";

// Sentinela do select de modelo/esforço: "herda" o padrão. Não é flag — vira frontmatter da skill ou
// sessão do agent ao montar o comando. Radix Select não aceita value vazio, então usamos um literal.
export const INVOKE_INHERIT = "inherit";

// CLI de trabalho da sessão: governa o comando montado (claude vs codex), os knobs de sessão exibidos
// e a grafia das skills no prompt (`/slug` no claude, `$slug` no codex).
export const INVOKE_CLIS = ["claude", "codex"] as const;

export type InvokeCli = (typeof INVOKE_CLIS)[number];

export const INVOKE_CLI_OPTIONS: { value: InvokeCli; label: string; hint: string }[] = [
	{ value: "claude", label: "Claude", hint: "sessões `claude` — skills invocadas com /" },
	{ value: "codex", label: "Codex", hint: "sessões `codex` — skills convertidas para $" },
];

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

// Aprovação/sandbox do `codex` — o equivalente funcional do permission mode do claude, com os flags
// próprios do codex. Ordem = ordem no select.
export type CodexApprovalMode = "bypass" | "fullAuto" | "readOnly" | "default";

export const CODEX_APPROVAL_OPTIONS: {
	value: CodexApprovalMode;
	label: string;
	hint: string;
}[] = [
	{ value: "bypass", label: "Auto", hint: "--dangerously-bypass-approvals-and-sandbox" },
	{ value: "fullAuto", label: "Full auto", hint: "--full-auto" },
	{ value: "readOnly", label: "Só leitura", hint: "--sandbox read-only" },
	{ value: "default", label: "Perguntar", hint: "aprovações padrão do codex" },
];

export const CODEX_MODEL_OPTIONS: InvokeOption[] = [
	{ value: INVOKE_INHERIT, label: "Modelo padrão", hint: "herda a config do codex" },
	{ value: "gpt-5.5", label: "GPT-5.5", hint: "-m gpt-5.5" },
	{ value: "gpt-5.5-codex", label: "GPT-5.5 Codex", hint: "-m gpt-5.5-codex" },
];

export const CODEX_EFFORT_OPTIONS: InvokeOption[] = [
	{ value: INVOKE_INHERIT, label: "Esforço padrão", hint: "herda a config do codex" },
	...(["low", "medium", "high", "xhigh"] as const).map((value) => ({
		value,
		label: EFFORT_LABELS[value],
		hint: `-c model_reasoning_effort=${value}`,
	})),
];
