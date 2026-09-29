import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";

import { orpc, orpcWs } from "@/client";
import type { ModelApplyStatus } from "@/components/agent-session/model-picker";
import type { InvokeCli } from "@/constants/invoke";
import { type ModelTarget, modelTargetDiff, sessionModelId } from "@/lib/model-target";
import { errorMessage } from "@/lib/orpc-errors";
import { subscribeWithRetry } from "@/lib/realtime-subscription";

const STATUS_RESET_MS = { applied: 1_800, failed: 4_000 };

// O catálogo chega pelo socket e é reenviado quando o cache de um CLI muda em disco: a lista nova
// entra no mesmo cache da query, sem ninguém recarregar a página.
function useModelCatalog(enabled: boolean) {
	const queryClient = useQueryClient();
	const catalog = useQuery({
		...orpc.agentRadar.modelCatalog.queryOptions(),
		staleTime: Number.POSITIVE_INFINITY,
		enabled,
	});

	useEffect(() => {
		if (!enabled) {
			return;
		}
		const controller = new AbortController();
		void subscribeWithRetry({
			label: "Catálogo de modelos",
			signal: controller.signal,
			subscribe: (signal) => orpcWs.modelCatalog.call(undefined, { signal }),
			onEvent: (event) => queryClient.setQueryData(orpc.agentRadar.modelCatalog.queryKey(), event),
		});

		return () => controller.abort();
	}, [enabled, queryClient]);

	return catalog.data;
}

// Modelo e esforço de um agent aberto no terminal, com a troca aplicada ao CLI vivo na hora da
// escolha. O valor em vigor é o que a tela do CLI mostra; o transcript é o aviso de que ele mudou
// (um `/model` digitado no terminal, uma resposta do modelo novo) e a reserva quando a tela não diz.
export function useSessionModel(params: {
	paneId: string;
	cli: InvokeCli | null;
	transcriptModel: string | null;
	transcriptEffort: string | null;
	agentStatus: string | undefined;
}) {
	const { paneId, cli } = params;
	const queryClient = useQueryClient();
	const catalog = useModelCatalog(!!cli);
	const configurationKey = orpc.agentRadar.modelConfiguration.queryKey({ input: { paneId } });
	const configuration = useQuery({
		...orpc.agentRadar.modelConfiguration.queryOptions({ input: { paneId } }),
		enabled: !!cli,
		staleTime: Number.POSITIVE_INFINITY,
		retry: false,
	});
	const refetchConfiguration = configuration.refetch;

	useEffect(() => {
		if (cli) {
			void refetchConfiguration();
		}
	}, [
		cli,
		params.transcriptModel,
		params.transcriptEffort,
		params.agentStatus,
		refetchConfiguration,
	]);

	const session = {
		cli,
		model: sessionModelId(
			cli ? catalog?.[cli] : undefined,
			configuration.data?.model ?? params.transcriptModel,
		),
		effort: configuration.data ? configuration.data.effort : params.transcriptEffort,
	};
	const latestSession = useRef(session);
	latestSession.current = session;

	const [choice, setChoice] = useState<ModelTarget | null>(null);
	const [status, setStatus] = useState<ModelApplyStatus>("idle");
	const configure = useMutation(orpc.agentRadar.configureModel.mutationOptions());
	const wanted = useRef<ModelTarget | null>(null);
	const running = useRef(false);
	const run = useRef<Promise<boolean>>(Promise.resolve(true));

	useEffect(() => {
		if (status !== "applied" && status !== "failed") {
			return;
		}
		const timer = setTimeout(() => setStatus("idle"), STATUS_RESET_MS[status]);

		return () => clearTimeout(timer);
	}, [status]);

	// Uma troca por vez no terminal: escolhas feitas no meio de uma aplicação substituem umas às
	// outras e só a última vai ao CLI quando a atual terminar.
	async function drain() {
		setStatus("applying");
		let applied = false;
		try {
			while (wanted.current) {
				const next = wanted.current;
				wanted.current = null;
				const diff = modelTargetDiff(next, latestSession.current);
				if (!diff) {
					continue;
				}
				const confirmed = await configure.mutateAsync({
					paneId,
					cli: next.cli,
					...(diff.model ? { model: diff.model } : {}),
					...(diff.effort ? { effort: diff.effort } : {}),
				});
				queryClient.setQueryData(configurationKey, confirmed);
				latestSession.current = { ...latestSession.current, ...confirmed };
				applied = true;
			}
			setChoice(null);
			setStatus(applied ? "applied" : "idle");

			return true;
		} catch (error) {
			wanted.current = null;
			setChoice(null);
			setStatus("failed");
			toast.error(errorMessage(error, "Não foi possível trocar o modelo"));
			void refetchConfiguration();

			return false;
		} finally {
			running.current = false;
		}
	}

	function change(target: ModelTarget) {
		setChoice(target);
		if (target.cli !== cli) {
			return;
		}
		wanted.current = target;
		if (!running.current) {
			running.current = true;
			run.current = drain();
		}
	}

	const target: ModelTarget = choice ?? {
		cli: cli ?? "claude",
		model: session.model,
		effort: session.effort,
	};

	return {
		catalog,
		session,
		target,
		status,
		// Troca de CLI fica pendente até o envio: é ela que dispara o resumo e a migração.
		crossCli: choice && choice.cli !== cli ? modelTargetDiff(choice, session) : null,
		change,
		clearChoice: () => setChoice(null),
		// O envio espera a troca em andamento: a mensagem tem que sair já no modelo escolhido.
		settle: async () => (running.current ? await run.current : true),
	};
}
