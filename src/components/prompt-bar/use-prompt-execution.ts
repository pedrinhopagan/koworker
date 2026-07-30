import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { type Selection, useInvocation } from "@/components/prompt-bar/use-invocation";
import { orpc, orpcWs } from "@/client";
import { INVOKE_INHERIT } from "@/constants/invoke";
import {
	buildKoworkerPrompt,
	buildPromptBody,
	convertSkillCallsForCli,
	flattenPrompt,
} from "@/lib/build-prompt";
import { newClientRequestId } from "@/lib/client-request-id";
import { type InvokeTarget, planInvocation } from "@/lib/invoke";
import { isNotFoundError } from "@/lib/orpc-errors";
import { recordPromptHistory } from "@/lib/prompt-history";
import { subscribeWithRetry } from "@/lib/realtime-subscription";
import { usePromptBarStore } from "@/stores/prompt-bar";
import type { TaskStage } from "@/constants/complexity";

type LiveEvent = {
	runId: string;
	status: "started" | "output" | "done" | "failed" | "timeout" | "cancelled";
	output?: string;
	error?: string;
};

function toTarget(selection: NonNullable<Selection>): InvokeTarget {
	if (selection.kind === "agent") {
		return { kind: "agent", slug: selection.agent.slug, label: selection.agent.label };
	}
	return { kind: "skill", slug: selection.skill.slug, label: selection.skill.label };
}

function withoutInherit(value: string): string | undefined {
	return value === INVOKE_INHERIT ? undefined : value;
}

function formatElapsed(ms: number): string {
	const totalSec = Math.floor(ms / 1000);
	const min = Math.floor(totalSec / 60);
	const sec = totalSec % 60;
	return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

export function usePromptExecution(params: {
	projectId?: string;
	projectName?: string;
	routePath: string | null;
	taskId?: string;
	nextStage?: TaskStage | null;
	active: boolean;
}) {
	const { projectId, routePath, active } = params;

	// Com o painel fechado o preview não aparece: assinar "" mantém o seletor estável e nenhuma tecla
	// re-renderiza o painel. Aberto, o deferred deixa o React priorizar a digitação sobre o preview.
	const text = useDeferredValue(usePromptBarStore((s) => (active ? s.text : "")));
	const cli = usePromptBarStore((s) => s.cli);
	const invoke = usePromptBarStore((s) => s.invoke);
	const structureTemplate = usePromptBarStore((s) => s.structureTemplate);
	const structureValues = usePromptBarStore((s) => s.structureValues);
	const images = usePromptBarStore((s) => s.images);
	const interactWithKw = usePromptBarStore((s) => s.interactWithKw);
	const interactWithRoute = usePromptBarStore((s) => s.interactWithRoute);
	const interactWithInput = usePromptBarStore((s) => s.interactWithInput);

	const { selection } = useInvocation(params);
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const project = projectsQuery.data?.find((entry) => entry.id === projectId);

	const effectiveRoute = interactWithRoute ? routePath : null;
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
		const model =
			cli === "codex" ? withoutInherit(invoke.codex.model) : withoutInherit(invoke.claude.model);
		const effort =
			cli === "codex" ? withoutInherit(invoke.codex.effort) : withoutInherit(invoke.claude.effort);
		return { prompt, model, effort, command: prompt };
	}, [selection, cli, interactWithKw, effectiveRoute, effectiveText, invoke]);

	const promptPreview = executionPlan.prompt.trim() || null;
	const canExecute = !!project && !!promptPreview;

	const [runId, setRunId] = useState<string | null>(() =>
		typeof window === "undefined" ? null : localStorage.getItem("kowork-active-run"),
	);
	const adoptedRunId = useRef(runId);
	const [live, setLive] = useState<LiveEvent | null>(null);
	const [liveOutput, setLiveOutput] = useState("");
	const [elapsedMs, setElapsedMs] = useState(0);
	const startedAtRef = useRef<number | null>(null);
	const lastNotified = useRef<LiveEvent["status"] | null>(null);
	// Reenviar o mesmo prompt reaproveita o identificador: o servidor devolve o run existente em vez
	// de despachar o agente de novo.
	const requestId = useRef(newClientRequestId());

	// O celular perde rede o tempo todo: parar o polling no primeiro erro deixava a tela presa para
	// sempre. Só um NOT_FOUND (o registro sumiu do banco) encerra o acompanhamento; qualquer outra
	// falha é transitória e o polling continua tentando.
	const statusQuery = useQuery({
		...orpc.prompt.runStatus.queryOptions({ input: { runId: runId ?? "" } }),
		enabled: !!runId,
		retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 3,
		refetchInterval: (query) => {
			if (isNotFoundError(query.state.error)) {
				return false;
			}
			if (!query.state.data || query.state.data.status === "running") {
				return 5000;
			}

			return false;
		},
	});

	// Claude vira sessão dedicada: o processo fica de pé e a conversa continua na rota. Codex segue
	// no modelo de chamada única — o `codex exec` não tem canal de controle equivalente.
	const startSessionMutation = useMutation({
		...orpc.agentSessions.start.mutationOptions(),
		onSuccess: async (session) => {
			usePromptBarStore.getState().setText("");
			await navigate({ to: "/executar/$executionId", params: { executionId: session.id } });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Não foi possível abrir a sessão"),
	});

	const executeMutation = useMutation({
		...orpc.prompt.execute.mutationOptions(),
		onSuccess: (result) => {
			setRunId(result.runId);
			localStorage.setItem("kowork-active-run", result.runId);
			setLive({ runId: result.runId, status: "started" });
			startedAtRef.current = Date.now();
			setElapsedMs(0);
			requestId.current = newClientRequestId();
			// A barra mostra só a cauda do que está acontecendo; quem quiser ver passo a passo e responder
			// ao agente vai para a conversa, que é a mesma tela usada no celular.
			toast.success("Execução despachada", {
				action: {
					label: "Acompanhar",
					onClick: () =>
						void navigate({
							to: "/executar/$executionId",
							params: { executionId: result.runId },
						}),
				},
			});
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Não foi possível iniciar a execução"),
	});

	const refetchStatus = statusQuery.refetch;

	useEffect(() => {
		if (!runId) {
			return;
		}
		const activeRunId = runId;
		lastNotified.current = null;
		setLiveOutput("");
		const controller = new AbortController();

		subscribeWithRetry({
			label: "PromptRun",
			signal: controller.signal,
			subscribe: (signal) => orpcWs.promptRun.call({ runId: activeRunId }, { signal }),
			onEvent: (event) => {
				// A barra global só acompanha a cauda do que o agente está escrevendo: o detalhe passo a
				// passo é a tela de conversa. Aqui `step` vale pelo texto que carrega junto.
				if (event.status === "output" || event.status === "step") {
					setLiveOutput(event.output ?? "");
					return;
				}

				setLive({ ...event, status: event.status });
			},
			onReconnect: () => void refetchStatus(),
		});

		return () => controller.abort();
	}, [runId, refetchStatus]);

	const record = statusQuery.data;
	// Um run que o backend não reconhece mais é uma execução interrompida, não uma execução viva.
	// Falha de rede não conta: o run segue vivo do outro lado e o polling volta sozinho.
	const runLost = !!runId && isNotFoundError(statusQuery.error);
	// O evento terminal do WebSocket pode se perder (run que falha em milissegundos termina antes da
	// assinatura), deixando `live` preso em "started". O status terminal vindo do polling do banco
	// precisa vencer esse "started" antigo — senão o spinner nunca fecha.
	const liveTerminal = live && live.status !== "started" ? live.status : null;
	const recordTerminal = record && record.status !== "running" ? record.status : null;
	const resolvedStatus = runLost
		? "failed"
		: (liveTerminal ?? recordTerminal ?? (live || record ? "running" : null));
	const isTerminal =
		resolvedStatus === "done" ||
		resolvedStatus === "failed" ||
		resolvedStatus === "timeout" ||
		resolvedStatus === "cancelled";
	const isRunning =
		executeMutation.isPending || startSessionMutation.isPending || (!!runId && !isTerminal);

	useEffect(() => {
		if (!isRunning || executeMutation.isPending) {
			if (!isRunning) {
				startedAtRef.current = null;
			}
			return;
		}
		if (!startedAtRef.current) {
			startedAtRef.current = record?.startedAt ?? Date.now();
		}
		const tick = () => {
			if (startedAtRef.current) {
				setElapsedMs(Date.now() - startedAtRef.current);
			}
		};
		tick();
		const interval = setInterval(tick, 1000);
		return () => clearInterval(interval);
	}, [isRunning, executeMutation.isPending, record?.startedAt]);

	const output = live?.output ?? record?.output ?? null;
	const error = runLost
		? "A execução foi interrompida: o servidor reiniciou ou perdeu o registro do run."
		: (live?.error ?? record?.error ?? null);

	useEffect(() => {
		if (!resolvedStatus || resolvedStatus === "running") {
			return;
		}
		if (lastNotified.current === resolvedStatus) {
			return;
		}
		lastNotified.current = resolvedStatus;
		localStorage.removeItem("kowork-active-run");
		if (adoptedRunId.current && adoptedRunId.current === runId) {
			adoptedRunId.current = null;
			setRunId(null);
			return;
		}
		if (resolvedStatus === "done") {
			toast.success("Execução concluída");
		} else {
			toast.error(error ?? "A execução falhou");
		}
	}, [resolvedStatus, error, runId]);

	function handleExecute() {
		if (!project || !promptPreview) {
			toast.error("Escolha o projeto antes de executar");
			return;
		}

		const agent = selection?.kind === "agent" ? selection.agent.slug : undefined;
		const approvalMode = cli === "codex" ? invoke.codex.approvalMode : undefined;
		const permissionMode = cli === "claude" ? invoke.claude.permissionMode : undefined;

		if (cli === "claude") {
			startSessionMutation.mutate({
				projectId: project.id,
				prompt: promptPreview,
				originalPrompt: effectiveText || text || promptPreview,
				inputKind: "text",
				// A barra guarda "bypass" (o `--dangerously-skip-permissions` da chamada única); a sessão
				// passa sempre por `--permission-mode`, onde o equivalente se chama bypassPermissions.
				permissionMode:
					permissionMode === "bypass" ? "bypassPermissions" : (permissionMode ?? "acceptEdits"),
				...(params.taskId ? { taskId: params.taskId } : {}),
				...(agent ? { agent } : {}),
				...(executionPlan.model ? { model: executionPlan.model } : {}),
				...(executionPlan.effort ? { effort: executionPlan.effort } : {}),
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

			return;
		}

		executeMutation.mutate({
			clientRequestId: requestId.current,
			projectId: project.id,
			...(params.taskId ? { taskId: params.taskId } : {}),
			prompt: promptPreview,
			originalPrompt: effectiveText || text || promptPreview,
			source: "global_bar",
			interactionMode: "unattended",
			inputKind: "text",
			cli,
			...(permissionMode ? { permissionMode } : {}),
			...(agent ? { agent } : {}),
			...(executionPlan.model ? { model: executionPlan.model } : {}),
			...(executionPlan.effort ? { effort: executionPlan.effort } : {}),
			...(approvalMode ? { approvalMode } : {}),
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
		canExecute,
		isRunning,
		liveOutput,
		elapsedLabel: formatElapsed(elapsedMs),
		output: resolvedStatus === "done" ? output : null,
		error: resolvedStatus === "failed" || resolvedStatus === "timeout" ? error : null,
		handleExecute,
	};
}
