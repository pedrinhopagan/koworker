import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Workflow } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { orpc, orpcWs, type RouterOutputs } from "@/client";
import { DocSheetActionButton } from "@/components/doc-mobile-actions-drawer";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type FlowEvent = NonNullable<RouterOutputs["flow"]["status"]["event"]>;

// Texto do passo corrente a partir dos fatos do evento (o backend manda status/stage/agent; a
// composição é do frontend). null quando não há nada a mostrar.
function describeEvent(event: FlowEvent | null): string | null {
	if (!event) {
		return null;
	}
	switch (event.status) {
		case "running": {
			if (event.agent === "revisor-tarefa") {
				return "Revisão final da tarefa…";
			}
			if (event.stage) {
				return `Rodando etapa ${event.stage} (${event.agent})…`;
			}
			return "Iniciando fluxo…";
		}
		case "waiting-user": {
			return event.message ?? "Aguardando você.";
		}
		case "failed": {
			return event.message ?? "O fluxo falhou.";
		}
		case "completed": {
			return "Fluxo concluído.";
		}
	}
}

// Dispara o fluxo autônomo da tarefa e acompanha o progresso: hidrata do `status` ao montar, segue
// os eventos ao vivo pelo WS e avisa por toast a cada desfecho terminal. O botão fica travado e vira
// spinner enquanto uma etapa roda.
export function FlowRunButton({
	taskId,
	layout = "inline",
	onAction,
}: {
	taskId: string;
	layout?: "inline" | "stacked";
	onAction?: () => void;
}) {
	const statusQuery = useQuery(orpc.flow.status.queryOptions({ input: { taskId } }));
	const [live, setLive] = useState<FlowEvent | null>(null);

	useEffect(() => {
		setLive(null);
		const controller = new AbortController();

		async function subscribe() {
			try {
				const events = await orpcWs.flow.call({ taskId }, { signal: controller.signal });
				for await (const event of events) {
					setLive(event);
				}
			} catch (error) {
				if (error instanceof Error && error.name === "AbortError") {
					return;
				}
				console.error("[Flow] Erro na subscription:", error);
			}
		}

		subscribe();
		return () => controller.abort();
	}, [taskId]);

	const event = live ?? statusQuery.data?.event ?? null;
	const isRunning = event?.status === "running" || (statusQuery.data?.running ?? false);

	// Toast só na transição para um estado terminal — não a cada re-render com o mesmo evento.
	const lastNotified = useRef<FlowEvent["status"] | null>(null);
	useEffect(() => {
		if (!event || event.status === "running") {
			return;
		}
		if (lastNotified.current === event.status) {
			return;
		}
		lastNotified.current = event.status;
		const text = describeEvent(event) ?? "";
		if (event.status === "completed") {
			toast.success(text);
		} else if (event.status === "waiting-user") {
			toast.info(text);
		} else {
			toast.error(text);
		}
	}, [event]);

	const runMutation = useMutation({
		...orpc.flow.run.mutationOptions(),
		onSuccess: (result) => {
			lastNotified.current = null;
			setLive(result.event);
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Não foi possível iniciar o fluxo"),
	});

	const disabled = isRunning || runMutation.isPending;
	const label = describeEvent(event);

	function handleClick() {
		runMutation.mutate({ taskId });
		onAction?.();
	}

	if (layout === "stacked") {
		return (
			<DocSheetActionButton
				icon={
					isRunning ? (
						<Loader2 className="size-[18px] animate-spin" />
					) : (
						<Workflow className="size-[18px]" />
					)
				}
				label={isRunning ? (label ?? "Rodando fluxo…") : "Rodar fluxo"}
				onClick={handleClick}
				disabled={disabled}
			/>
		);
	}

	return (
		<Tooltip label={isRunning ? (label ?? "Rodando fluxo…") : "Rodar o fluxo da tarefa"}>
			<button
				type="button"
				onClick={handleClick}
				disabled={disabled}
				className={cn(
					"flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground",
					disabled &&
						"cursor-not-allowed opacity-60 hover:bg-transparent hover:text-muted-foreground",
				)}
				aria-label="Rodar fluxo"
			>
				{isRunning ? <Loader2 size={14} className="animate-spin" /> : <Workflow size={14} />}
				<span className="hidden sm:inline">{isRunning ? "Rodando" : "Rodar fluxo"}</span>
			</button>
		</Tooltip>
	);
}
