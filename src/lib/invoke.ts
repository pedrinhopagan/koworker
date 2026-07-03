import { type InvokeCli, INVOKE_INHERIT } from "@/constants/invoke";
import { buildKoworkerPrompt, convertSkillCallsForCli, flattenPrompt } from "@/lib/build-prompt";
import { buildClaudeCommand } from "@/lib/claude-command";
import { buildCodexCommand } from "@/lib/codex-command";
import { recordPromptHistory } from "@/lib/prompt-history";
import { executeInTerminal, type ProjectInfo } from "@/lib/terminal";
import type { InvokeConfig } from "@/stores/prompt-bar";

// O alvo de uma invocação é exatamente um: um agent (roda `/kw` sob `--agent`, só no claude) ou uma
// skill (roda `/<slug>` direto; no codex vira `$<slug>`). Model/effort vêm da sessão ativa em
// `config`: o painel pré-seleciona o padrão do alvo ao escolhê-lo, então `INVOKE_INHERIT` aqui já
// significa "sem flag".
export type InvokeTarget =
	| { kind: "agent"; slug: string; label: string }
	| { kind: "skill"; slug: string; label: string };

// Tudo já resolvido pelo chamador: `kw` liga o prefixo `/kw`, `routePath` é o caminho quando "rota"
// está ligada (senão null) e `text` é o texto do prompt quando "input" está ligado (senão ""). Assim
// o builder não reimplementa as regras dos checkboxes. `cli` decide o comando (claude vs codex) e a
// grafia das skills.
export type InvokeRequest = {
	target: InvokeTarget;
	cli: InvokeCli;
	kw: boolean;
	routePath: string | null;
	text: string;
	config: InvokeConfig;
};

// Prompt sempre em UMA linha: `tmux send-keys` trata quebra como Enter e submeteria o comando cedo —
// essa é a correção de fundo das invocações. Agent: `/kw <rota> <texto>`; skill com kw ligado: `/kw
// <rota> /<slug> <texto>` (o `/kw` assume a cabeça e a rota como alvo, a skill desce pro corpo);
// skill sem kw: `/<slug> <rota> <texto>`, com rota/texto como args posicionais. No fim, o cli
// converte a grafia das skills (`/` → `$` no codex).
function buildPrompt({ target, cli, kw, routePath, text }: InvokeRequest): string {
	if (target.kind === "agent") {
		return convertSkillCallsForCli(
			flattenPrompt(buildKoworkerPrompt({ kw, target: routePath, text })),
			cli,
		);
	}
	const skill = `/${target.slug}`;
	const parts = kw
		? ["/kw", routePath, skill, flattenPrompt(text)]
		: [skill, routePath, flattenPrompt(text)];
	return convertSkillCallsForCli(parts.filter(Boolean).join(" "), cli);
}

export type InvokePlan = {
	prompt: string;
	model: string | undefined;
	effort: string | undefined;
	// Reflexo fiel do comando que o backend monta — alimenta o preview ao vivo no prompt-bar.
	command: string;
};

function withoutInherit(value: string): string | undefined {
	return value === INVOKE_INHERIT ? undefined : value;
}

export function planInvocation(request: InvokeRequest): InvokePlan {
	const { target, cli, config } = request;
	const prompt = buildPrompt(request);

	if (cli === "codex") {
		const model = withoutInherit(config.codex.model);
		const effort = withoutInherit(config.codex.effort);
		const command = buildCodexCommand({
			prompt,
			approvalMode: config.codex.approvalMode,
			...(model ? { model } : {}),
			...(effort ? { effort } : {}),
		});
		return { prompt, model, effort, command };
	}

	const model = withoutInherit(config.claude.model);
	const effort = withoutInherit(config.claude.effort);
	const command = buildClaudeCommand({
		prompt,
		permissionMode: config.claude.permissionMode,
		...(target.kind === "agent" ? { agent: target.slug } : {}),
		...(model ? { model } : {}),
		...(effort ? { effort } : {}),
	});

	return { prompt, model, effort, command };
}

// Dispara a invocação numa aba do terminal do projeto e registra no histórico. Ponto único de
// verdade pra agent e skill: ambos passam por aqui.
export function runInvocation(params: { project: ProjectInfo; request: InvokeRequest }) {
	const { project, request } = params;
	const { target, cli, routePath, text, config } = request;
	const { prompt, model, effort } = planInvocation(request);
	// O backend rebuilda o comando com os mesmos params do preview; no codex, o campo `permissionMode`
	// carrega o approvalMode (é o "modo de permissão" daquele cli).
	const permissionMode = cli === "codex" ? config.codex.approvalMode : config.claude.permissionMode;

	void executeInTerminal(
		project,
		{ id: `${target.kind}_${target.slug}`, title: target.label },
		prompt,
		{
			cli,
			...(cli === "claude" && target.kind === "agent" ? { agent: target.slug } : {}),
			...(model ? { model } : {}),
			...(effort ? { effort } : {}),
			permissionMode,
			forceNew: config.forceNew,
			background: config.background,
		},
	);

	recordPromptHistory({
		kind: target.kind,
		text,
		prompt,
		...(routePath ? { target: routePath } : {}),
		...(target.kind === "agent" ? { agentSlug: target.slug } : { skillSlug: target.slug }),
		projectId: project.id,
		projectName: project.name,
		...(model ? { model } : {}),
		...(effort ? { effort } : {}),
	});
}
