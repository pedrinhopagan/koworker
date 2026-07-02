import { INVOKE_INHERIT } from "@/constants/invoke";
import { buildKoworkerPrompt, flattenPrompt } from "@/lib/build-prompt";
import { buildClaudeCommand } from "@/lib/claude-command";
import { recordPromptHistory } from "@/lib/prompt-history";
import { executeInTerminal, type ProjectInfo } from "@/lib/terminal";
import type { InvokeConfig } from "@/stores/prompt-bar";

// O alvo de uma invocação é exatamente um: um agent (roda `/kw` sob `--agent`) ou uma skill (roda
// `/<slug>` direto). Model/effort vêm de `config`: o painel pré-seleciona o padrão do alvo ao
// escolhê-lo, então `INVOKE_INHERIT` aqui já significa "sem flag".
export type InvokeTarget =
	| { kind: "agent"; slug: string; label: string }
	| { kind: "skill"; slug: string; label: string };

// Tudo já resolvido pelo chamador: `kw` liga o prefixo `/kw`, `routePath` é o caminho quando "rota"
// está ligada (senão null) e `text` é o texto do prompt quando "input" está ligado (senão ""). Assim
// o builder não reimplementa as regras dos checkboxes.
export type InvokeRequest = {
	target: InvokeTarget;
	kw: boolean;
	routePath: string | null;
	text: string;
	config: InvokeConfig;
};

// Prompt sempre em UMA linha: `tmux send-keys` trata quebra como Enter e submeteria o comando cedo —
// essa é a correção de fundo das invocações. Agent: `/kw <rota> <texto>`; skill com kw ligado: `/kw
// <rota> /<slug> <texto>` (o `/kw` assume a cabeça e a rota como alvo, a skill desce pro corpo);
// skill sem kw: `/<slug> <rota> <texto>`, com rota/texto como args posicionais.
function buildPrompt({ target, kw, routePath, text }: InvokeRequest): string {
	if (target.kind === "agent") {
		return flattenPrompt(buildKoworkerPrompt({ kw, target: routePath, text }));
	}
	const skill = `/${target.slug}`;
	const parts = kw
		? ["/kw", routePath, skill, flattenPrompt(text)]
		: [skill, routePath, flattenPrompt(text)];
	return parts.filter(Boolean).join(" ");
}

export type InvokePlan = {
	prompt: string;
	model: string | undefined;
	effort: string | undefined;
	// Reflexo fiel do comando que o backend monta — alimenta o preview ao vivo no prompt-bar.
	command: string;
};

export function planInvocation(request: InvokeRequest): InvokePlan {
	const { target, config } = request;
	const prompt = buildPrompt(request);
	const model = config.model === INVOKE_INHERIT ? undefined : config.model;
	const effort = config.effort === INVOKE_INHERIT ? undefined : config.effort;

	const command = buildClaudeCommand({
		prompt,
		permissionMode: config.permissionMode,
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
	const { target, routePath, text, config } = request;
	const { prompt, model, effort } = planInvocation(request);

	void executeInTerminal(
		project,
		{ id: `${target.kind}_${target.slug}`, title: target.label },
		prompt,
		{
			...(target.kind === "agent" ? { agent: target.slug } : {}),
			...(model ? { model } : {}),
			...(effort ? { effort } : {}),
			permissionMode: config.permissionMode,
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
