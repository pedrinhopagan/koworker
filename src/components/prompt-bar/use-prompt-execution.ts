import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useDeferredValue, useMemo } from "react";
import { toast } from "sonner";

import { type Selection, useInvocation } from "@/components/prompt-bar/use-invocation";
import { orpc } from "@/client";
import { INVOKE_INHERIT } from "@/constants/invoke";
import type { TaskStage } from "@/constants/complexity";
import {
	buildKoworkerPrompt,
	buildPromptBody,
	convertSkillCallsForCli,
	flattenPrompt,
} from "@/lib/build-prompt";
import { type InvokeTarget, planInvocation } from "@/lib/invoke";
import { recordPromptHistory } from "@/lib/prompt-history";
import { usePromptBarStore } from "@/stores/prompt-bar";

function toTarget(selection: NonNullable<Selection>): InvokeTarget {
	if (selection.kind === "agent") {
		return { kind: "agent", slug: selection.agent.slug, label: selection.agent.label };
	}

	return { kind: "skill", slug: selection.skill.slug, label: selection.skill.label };
}

function withoutInherit(value: string) {
	return value === INVOKE_INHERIT ? undefined : value;
}

export function usePromptExecution(params: {
	projectId?: string;
	projectName?: string;
	routePath: string | null;
	taskId?: string;
	nextStage?: TaskStage | null;
	active: boolean;
}) {
	const text = useDeferredValue(usePromptBarStore((state) => (params.active ? state.text : "")));
	const cli = usePromptBarStore((state) => state.cli);
	const invoke = usePromptBarStore((state) => state.invoke);
	const structureTemplate = usePromptBarStore((state) => state.structureTemplate);
	const structureValues = usePromptBarStore((state) => state.structureValues);
	const images = usePromptBarStore((state) => state.images);
	const interactWithKw = usePromptBarStore((state) => state.interactWithKw);
	const interactWithRoute = usePromptBarStore((state) => state.interactWithRoute);
	const interactWithInput = usePromptBarStore((state) => state.interactWithInput);
	const { selection } = useInvocation(params);
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const project = projectsQuery.data?.find((entry) => entry.id === params.projectId);
	const effectiveRoute = interactWithRoute ? params.routePath : null;
	const effectiveText = interactWithInput
		? buildPromptBody({ templateSlug: structureTemplate, values: structureValues, text, images })
		: "";

	const executionPlan = useMemo(() => {
		if (selection) {
			return planInvocation({
				target: toTarget(selection),
				cli,
				kw: interactWithKw,
				routePath: effectiveRoute,
				text: effectiveText,
				config: invoke,
			});
		}

		const prompt = convertSkillCallsForCli(
			flattenPrompt(
				buildKoworkerPrompt({ kw: interactWithKw, target: effectiveRoute, text: effectiveText }),
			),
			cli,
		);

		return {
			prompt,
			model: withoutInherit(cli === "codex" ? invoke.codex.model : invoke.claude.model),
			effort: withoutInherit(cli === "codex" ? invoke.codex.effort : invoke.claude.effort),
			command: prompt,
		};
	}, [selection, cli, interactWithKw, effectiveRoute, effectiveText, invoke]);

	const promptPreview = executionPlan.prompt.trim() || null;
	const start = useMutation({
		...orpc.kwTerminal.sessionStart.mutationOptions(),
		onError: (error) =>
			toast.error(error instanceof Error ? error.message : "Não foi possível abrir a conversa"),
		onSuccess: async (result) => {
			usePromptBarStore.getState().clear();
			await navigate({ to: "/terminals/$paneId", params: { paneId: result.paneId } });
		},
	});

	function handleExecute() {
		if (!project || !promptPreview) {
			toast.error("Escolha o projeto antes de abrir a conversa");
			return;
		}

		const agent = selection?.kind === "agent" ? selection.agent.slug : undefined;
		start.mutate({
			projectId: project.id,
			cli,
			prompt: promptPreview,
			label: selection?.kind === "agent" ? selection.agent.label : selection?.skill.label,
			...(agent && cli === "claude" ? { agent } : {}),
			...(executionPlan.model ? { model: executionPlan.model } : {}),
			...(executionPlan.effort ? { effort: executionPlan.effort } : {}),
			...(cli === "claude"
				? {
						permissionMode:
							invoke.claude.permissionMode === "bypass"
								? ("default" as const)
								: invoke.claude.permissionMode,
					}
				: {
						approvalMode:
							invoke.codex.approvalMode === "bypass"
								? ("default" as const)
								: invoke.codex.approvalMode,
					}),
		});

		recordPromptHistory({
			kind: selection?.kind ?? "copy",
			text: effectiveText || text,
			prompt: promptPreview,
			...(effectiveRoute ? { target: effectiveRoute } : {}),
			...(selection?.kind === "agent"
				? { agentSlug: selection.agent.slug }
				: selection?.kind === "skill"
					? { skillSlug: selection.skill.slug }
					: {}),
			projectId: project.id,
			projectName: project.name,
			...(pathname ? { routePath: pathname } : {}),
			...(executionPlan.model ? { model: executionPlan.model } : {}),
			...(executionPlan.effort ? { effort: executionPlan.effort } : {}),
		});
	}

	return {
		cli,
		invoke,
		promptPreview,
		canExecute: !!project && !!promptPreview,
		isRunning: start.isPending,
		liveOutput: "",
		elapsedLabel: "",
		output: null,
		error: null,
		handleExecute,
	};
}
