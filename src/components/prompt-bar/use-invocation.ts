import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { STAGE_AGENT, type TaskStage } from "@/constants/complexity";
import { INVOKE_INHERIT } from "@/constants/invoke";
import { useAgentsQuery } from "@/hooks/use-agents";
import { useSkillsQuery } from "@/hooks/use-skills";
import { buildKoworkerPrompt, buildPromptBody, flattenPrompt } from "@/lib/build-prompt";
import { convertSkillCallsForCli } from "@/lib/build-prompt";
import { type InvokeTarget, planInvocation, runInvocation } from "@/lib/invoke";
import { usePromptBarStore } from "@/stores/prompt-bar";
import type { TaskAgent } from "@/types/agents";
import type { TaskSkill } from "@/types/skills";

export type Selection =
	| { kind: "agent"; agent: TaskAgent }
	| { kind: "skill"; skill: TaskSkill }
	| null;

function toTarget(selection: NonNullable<Selection>): InvokeTarget {
	if (selection.kind === "agent") {
		return { kind: "agent", slug: selection.agent.slug, label: selection.agent.label };
	}
	return { kind: "skill", slug: selection.skill.slug, label: selection.skill.label };
}

// Padrão de model/effort que o alvo carrega no frontmatter. String não-vazia vira a pré-seleção do
// select; ausência cai em `INVOKE_INHERIT` ("padrão" = sem flag). Um ID de modelo completo passa
// reto — o select ganha um item extra pra refleti-lo. Frontmatter é conceito do claude; a sessão
// codex não é tocada.
function metaDefault(value: unknown): string {
	return typeof value === "string" && value.trim() ? value.trim() : INVOKE_INHERIT;
}

// Estado e ações da invocação, compartilhados entre o painel "Invocação" (alvo + sessão + preview) e
// a seção de ações do prompt-bar (botão Invocar). A seleção vive no store como kind+slug; aqui ela
// vira o agent/skill completo pelas listas em cache.
export function useInvocation(params: {
	projectName?: string;
	routePath: string | null;
	nextStage?: TaskStage | null;
	active: boolean;
}) {
	const { projectName, routePath, nextStage } = params;

	// Painel fechado assina "" (nenhuma tecla re-renderiza); aberto, o deferred prioriza a digitação
	// sobre o preview do comando.
	const text = useDeferredValue(usePromptBarStore((s) => (params.active ? s.text : "")));
	const cli = usePromptBarStore((s) => s.cli);
	const structureTemplate = usePromptBarStore((s) => s.structureTemplate);
	const structureValues = usePromptBarStore((s) => s.structureValues);
	const images = usePromptBarStore((s) => s.images);
	const interactWithKw = usePromptBarStore((s) => s.interactWithKw);
	const interactWithRoute = usePromptBarStore((s) => s.interactWithRoute);
	const interactWithInput = usePromptBarStore((s) => s.interactWithInput);
	const invoke = usePromptBarStore((s) => s.invoke);
	const selectionRef = usePromptBarStore((s) => s.selection);
	const setSelection = usePromptBarStore((s) => s.setSelection);
	const patchClaudeSession = usePromptBarStore((s) => s.patchClaudeSession);

	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const { taskAgents, isLoading: agentsLoading } = useAgentsQuery();
	const { taskSkills, isLoading: skillsLoading } = useSkillsQuery(projectName);

	const selection = useMemo<Selection>(() => {
		if (!selectionRef) return null;
		if (selectionRef.kind === "agent") {
			const agent = taskAgents.find((a) => a.slug === selectionRef.slug);
			return agent ? { kind: "agent", agent } : null;
		}
		const skill = taskSkills.find((s) => s.slug === selectionRef.slug);
		return skill ? { kind: "skill", skill } : null;
	}, [selectionRef, taskAgents, taskSkills]);

	// Skills são scoped por projeto: ao trocar o projeto em foco, a skill escolhida pode nem existir
	// mais. Zera o alvo (e os defaults que ele pré-selecionou) pra não invocar a definição errada.
	useEffect(() => {
		setSelection(null);
		patchClaudeSession({ model: INVOKE_INHERIT, effort: INVOKE_INHERIT });
	}, [projectName, patchClaudeSession, setSelection]);

	// Agents são um conceito do claude (`--agent`); mudar pro codex com um agent selecionado solta o
	// alvo pra não montar um comando impossível.
	useEffect(() => {
		if (cli === "codex" && selectionRef?.kind === "agent") {
			setSelection(null);
		}
	}, [cli, selectionRef, setSelection]);

	// Só skills com invocação rápida entram na lista (mesmo critério do menu /).
	const skillList = useMemo(() => taskSkills.filter((skill) => skill.quickInvoke), [taskSkills]);

	// Agente do próximo passo do fluxo da tarefa aberta (backend infere `nextStage` pelos artefatos).
	// Vira o chip de sugestão pré-selecionável enquanto nenhum alvo foi escolhido — só no claude.
	const suggestedAgent = useMemo(() => {
		if (!nextStage || cli === "codex") return null;
		const slug = STAGE_AGENT[nextStage];
		return taskAgents.find((agent) => agent.slug === slug) ?? null;
	}, [nextStage, cli, taskAgents]);

	const effectiveRoute = interactWithRoute ? routePath : null;
	// O corpo compõe a estrutura (template ativo do painel de anexos) antes do texto livre — o mesmo
	// que o "Copiar prompt" produz.
	const effectiveText = interactWithInput
		? buildPromptBody({ templateSlug: structureTemplate, values: structureValues, text, images })
		: "";

	// Escolher um alvo fixa a seleção e puxa o model/effort padrão dele pros selects da sessão claude —
	// é o que o usuário vê e pode sobrescrever antes de invocar. Dono do default é o frontmatter do
	// alvo; os selects são só a janela editável disso, então model/effort não persistem (ver store).
	function selectTarget(next: NonNullable<Selection>) {
		const target = next.kind === "agent" ? next.agent : next.skill;
		setSelection({ kind: next.kind, slug: target.slug });
		patchClaudeSession({
			model: metaDefault(target.metadata.model),
			effort: metaDefault(target.metadata.effort),
		});
	}

	// Limpar o alvo solta também os defaults pré-selecionados: sem alvo, sem model/effort.
	function clearTarget() {
		setSelection(null);
		patchClaudeSession({ model: INVOKE_INHERIT, effort: INVOKE_INHERIT });
	}

	// Com alvo: o comando exato do cli ativo. Sem alvo: o prompt que "Copiar prompt" produz — assim os
	// toggles têm feedback visível mesmo antes de escolher agent/skill.
	const preview = useMemo(() => {
		if (selection) {
			return planInvocation({
				target: toTarget(selection),
				cli,
				kw: interactWithKw,
				routePath: effectiveRoute,
				text: effectiveText,
				config: invoke,
			}).command;
		}
		const prompt = convertSkillCallsForCli(
			flattenPrompt(
				buildKoworkerPrompt({ kw: interactWithKw, target: effectiveRoute, text: effectiveText }),
			),
			cli,
		);
		return prompt || null;
	}, [selection, cli, interactWithKw, effectiveRoute, effectiveText, invoke]);

	function handleInvoke() {
		const project = projectsQuery.data?.find((p) => p.name === projectName);
		if (!project || !selection) {
			toast.error("Projeto da rota não encontrado");
			return;
		}
		runInvocation({
			project: { id: project.id, name: project.name, mainRoute: project.mainRoute },
			request: {
				target: toTarget(selection),
				cli,
				kw: interactWithKw,
				routePath: effectiveRoute,
				text: effectiveText,
				config: invoke,
			},
		});
	}

	return {
		selection,
		selectTarget,
		clearTarget,
		suggestedAgent,
		skillList,
		taskAgents,
		agentsLoading,
		skillsLoading,
		preview,
		canInvoke: !!projectName && !!selection,
		handleInvoke,
	};
}
