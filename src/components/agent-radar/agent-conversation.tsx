import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDown, Loader2, SquareTerminal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { TerminalWorkspaceEntry } from "@/api/schemas/terminal-workspace";
import { orpc } from "@/client";
import { agentCliVisual } from "@/components/agent-radar/agent-cli";
import { LinkCwdProvider } from "@/components/link-cwd";
import { PaneStatusStrip } from "@/components/agent-radar/pane-status-strip";
import { ModelPicker } from "@/components/agent-session/model-picker";
import { SessionTimeline } from "@/components/agent-session/session-timeline";
import { ThreadComposer } from "@/components/agent-session/thread-composer";
import { Button } from "@/components/ui/button";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { agentRadarAgentLabel, agentRadarCli } from "@/constants/agent-radar";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { useAgentRadarTranscript } from "@/hooks/use-agent-radar-transcript";
import { type ModelTarget, modelTargetDiff, sessionModelId } from "@/lib/model-target";
import { countPromptReceipts, waitForPromptReceipt } from "@/lib/agent-prompt-receipt";
import { errorMessage } from "@/lib/orpc-errors";
import { clearPromptDraft } from "@/lib/prompt-draft";
import { activePaneMove, usePaneMoves } from "@/stores/pane-moves";

const CATALOG_STALE_MS = 5 * 60_000;
const HANDOFF_POLL_MS = 1_500;
// Pane recém-aberto pode chegar à tela antes de o radar anunciá-lo: "fechado" só depois desse
// respiro, senão a conversa nova abre com um aviso de pane morto por um instante.
const CLOSED_SETTLE_MS = 2_500;

function handoffActive(phase: string | undefined) {
	return phase === "compacting" || phase === "starting";
}

export function AgentConversationView({
	paneId,
	shell,
	onOpenTerminal,
}: {
	paneId: string;
	shell?: Extract<TerminalWorkspaceEntry, { kind: "shell" }>;
	onOpenTerminal?: () => void;
}) {
	const viewport = useRef<HTMLDivElement>(null);
	const content = useRef<HTMLDivElement>(null);
	// O grude no fim é decidido a cada quadro de rolagem, então mora numa ref: virar estado a cada
	// evento de scroll redesenhava a conversa inteira enquanto o dedo ainda estava na tela.
	const anchored = useRef(true);
	const [pinned, setPinned] = useState(true);
	const { agents, loading: radarLoading } = useAgentRadar();
	const radarAgent = agents.find((candidate) => candidate.paneId === paneId) ?? null;
	const agent = shell?.agent
		? {
				agent: shell.agent,
				status: shell.status === "working" ? ("working" as const) : ("idle" as const),
				changedAt: shell.changedAt,
				activity: null,
				tabLabel: shell.label,
				cwd: shell.cwd,
				projectName: shell.projectName,
			}
		: radarAgent;
	const transcript = useAgentRadarTranscript(paneId);
	const latestEvents = useRef(transcript.events);
	latestEvents.current = transcript.events;
	const receiptController = useRef<AbortController | null>(null);
	const [confirming, setConfirming] = useState(false);
	useEffect(() => () => receiptController.current?.abort(), []);
	const cwd = transcript.source?.cwd ?? agent?.cwd;
	const cli = agent
		? agentCliVisual(agent.agent)
		: { label: "Agent", icon: SquareTerminal, tone: "text-muted-foreground" };
	const busy = agent?.status === "working";
	const blocked = agent?.status === "blocked";

	// A escolha do seletor vale para a próxima mensagem. Nula, a mensagem vai como está; preenchida,
	// só o que difere do que o transcript reporta vira troca — e a marca de pendência some sozinha
	// quando a sessão passa a reportar o que foi escolhido.
	const catalog = useQuery({
		...orpc.agentRadar.modelCatalog.queryOptions(),
		staleTime: CATALOG_STALE_MS,
		enabled: !shell,
	});
	const sessionCli = agentRadarCli(agent?.agent);
	const session = {
		cli: sessionCli,
		model: sessionModelId(sessionCli ? catalog.data?.[sessionCli] : undefined, transcript.model),
		effort: transcript.effort,
	};
	const [choice, setChoice] = useState<ModelTarget | null>(null);
	const target: ModelTarget = choice ?? {
		cli: sessionCli ?? "claude",
		model: session.model,
		effort: session.effort,
	};
	const diff = choice ? modelTargetDiff(choice, session) : null;

	// Conversa em trânsito para outro pane (reaberta com outro modelo ou migrada de CLI). O registro
	// vive no store porque é a página `/shells` que segura a aba e navega quando o pane novo chega.
	const moveKey = `agent:${paneId}`;
	const move = usePaneMoves((state) => activePaneMove(state.moves, moveKey));
	const beginMove = usePaneMoves((state) => state.begin);
	const landMove = usePaneMoves((state) => state.land);
	const clearMove = usePaneMoves((state) => state.clear);
	// A fase da migração, para o aviso; quem a leva até o fim é a página `/shells`, que sobrevive ao
	// pane antigo fechar.
	const handoff = useQuery({
		...orpc.agentRadar.switchStatus.queryOptions({ input: { paneId } }),
		enabled: !shell,
		refetchInterval: (query) => (handoffActive(query.state.data?.phase) ? HANDOFF_POLL_MS : false),
	});
	const switching = handoffActive(handoff.data?.phase);
	const [settled, setSettled] = useState(false);
	const closed = !agent && !radarLoading && settled && !move;

	useEffect(() => {
		setSettled(false);
		const timer = setTimeout(() => setSettled(true), CLOSED_SETTLE_MS);

		return () => clearTimeout(timer);
	}, [paneId]);

	// App reaberto no meio de uma migração: o registro em memória se perdeu, o job no backend não.
	useEffect(() => {
		if (handoff.data && handoffActive(handoff.data.phase) && !move) {
			beginMove(moveKey, handoff.data.cli, "handoff");
		}
	}, [beginMove, handoff.data, move, moveKey]);

	useEffect(() => {
		if (move?.to) {
			clearPromptDraft(`kowork-radar-draft-${paneId}`);
		}
	}, [move?.to, paneId]);

	const sendShell = useMutation({
		...orpc.shells.send.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível enviar ao shell")),
	});
	const send = useMutation({
		...orpc.agentRadar.send.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível responder ao agent")),
	});
	const switchModel = useMutation({
		...orpc.agentRadar.switchModel.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível trocar o modelo")),
	});
	const syncTranscript = useMutation({
		...orpc.agentRadar.syncTranscript.mutationOptions(),
		onSuccess: ({ found }) => {
			if (!found) {
				toast.info("Nenhuma conversa foi encontrada para este agent");
			}
		},
		onError: (error) => toast.error(errorMessage(error, "Não foi possível sincronizar a conversa")),
	});

	// Salto seco em vez de rolagem animada: cada bloco novo disparava uma animação que a próxima
	// cancelava, e o resultado era uma conversa que nunca parava de deslizar sob o dedo.
	const scrollToEnd = useCallback(() => {
		const node = viewport.current;
		if (node) {
			node.scrollTop = node.scrollHeight;
		}
	}, []);

	const stickToEnd = useCallback(() => {
		anchored.current = true;
		setPinned(true);
		scrollToEnd();
	}, [scrollToEnd]);

	// Um observador só, montado uma vez: o conteúdo cresce e a conversa acompanha enquanto o leitor
	// estiver no fim. Refazer isso a cada bloco custava mais do que o próprio bloco.
	useEffect(() => {
		const node = content.current;
		if (!node) {
			return;
		}

		function follow() {
			if (anchored.current) {
				scrollToEnd();
			}
		}

		const observer = new ResizeObserver(follow);
		observer.observe(node);
		if (viewport.current) {
			observer.observe(viewport.current);
		}
		window.visualViewport?.addEventListener("resize", follow);

		return () => {
			observer.disconnect();
			window.visualViewport?.removeEventListener("resize", follow);
		};
	}, [scrollToEnd]);

	useEffect(() => {
		stickToEnd();
	}, [paneId, stickToEnd]);

	async function submit(text: string) {
		stickToEnd();
		if (shell) {
			if (shell.agent !== "claude" && shell.agent !== "codex") {
				return false;
			}
			const previousCount = countPromptReceipts(latestEvents.current, text);
			const controller = new AbortController();
			receiptController.current = controller;
			setConfirming(true);
			try {
				await sendShell.mutateAsync({
					id: shell.id,
					agent: shell.agent,
					text,
					...(transcript.source ? { sourcePath: transcript.source.path } : {}),
				});
				if (text.startsWith("/")) {
					return true;
				}
				const received = await waitForPromptReceipt({
					text,
					previousCount,
					events: () => latestEvents.current,
					signal: controller.signal,
				});
				if (!received && !controller.signal.aborted) {
					toast.warning(
						"O agente ainda não confirmou a mensagem. Seu rascunho foi mantido. Confira o terminal antes de reenviar.",
					);
				}
				return received;
			} catch {
				return false;
			} finally {
				setConfirming(false);
			}
		}
		if (!diff) {
			try {
				await send.mutateAsync({ paneId, text });
				return true;
			} catch {
				return false;
			}
		}
		if (busy) {
			toast.info("Aguarde o agent terminar o turno para trocar de modelo");
			return false;
		}

		// O registro entra antes da chamada: o pane atual fecha no meio dela, e a página precisa
		// saber desde já que a conversa está em trânsito para não mostrar o estado vazio.
		beginMove(moveKey, target.cli, diff.cli ? "handoff" : "reopen");
		try {
			const result = await switchModel.mutateAsync({
				paneId,
				cli: target.cli,
				...(diff.model ? { model: diff.model } : {}),
				...(diff.effort ? { effort: diff.effort } : {}),
				text,
			});
			if (result.kind === "handoff") {
				// O rascunho fica até a migração terminar: se ela falhar, a mensagem continua ali.
				void handoff.refetch();
				return false;
			}

			landMove(moveKey, `agent:${result.paneId}`);
			return true;
		} catch {
			clearMove(moveKey);
			return false;
		}
	}

	const targetLabel = agentRadarAgentLabel(move?.cli ?? handoff.data?.cli ?? target.cli);
	const switchingHint =
		move?.to || move?.kind === "reopen"
			? "Abrindo a conversa no novo pane…"
			: handoff.data?.phase === "starting"
				? `Abrindo a sessão ${targetLabel}…`
				: `Resumindo a conversa para continuar no ${targetLabel}…`;
	const inTransit = switching || !!move;
	function composerHint() {
		if (closed) {
			return "Esta sessão foi fechada.";
		}
		if (inTransit) {
			return switchingHint;
		}
		if (blocked) {
			return "Responda pelo terminal para continuar.";
		}
		return "Conectando à conversa…";
	}
	function emptyHint() {
		if (closed) {
			return "Esta sessão foi encerrada.";
		}
		if (shell) {
			return "Envie a primeira mensagem. O histórico aparece automaticamente. Se houver login ou uma pergunta pendente, abra o terminal.";
		}
		return "Envie a primeira mensagem abaixo. Se a sessão já existia, sincronize o histórico.";
	}

	return (
		<div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-muted/10">
			<PaneStatusStrip agent={agent} closed={closed} model={transcript.model} />
			{onOpenTerminal &&
				(blocked || transcript.missing || (shell && transcript.events.length === 0)) && (
					<div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs">
						<span className="min-w-0 text-muted-foreground">
							{blocked
								? "O agente precisa da sua resposta no terminal."
								: "Permissões, login e comandos interativos ficam no terminal."}
						</span>
						<Button variant="outline" className="min-h-12 shrink-0" onClick={onOpenTerminal}>
							<SquareTerminal className="size-4" />
							Abrir terminal
						</Button>
					</div>
				)}

			<div
				ref={viewport}
				data-component="conversation-viewport"
				onScroll={(event) => {
					const node = event.currentTarget;
					const atEnd = node.scrollHeight - node.scrollTop - node.clientHeight < 24;
					if (atEnd !== anchored.current) {
						anchored.current = atEnd;
						setPinned(atEnd);
					}
				}}
				className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 sm:px-4"
			>
				<div ref={content} className="mx-auto w-full max-w-3xl space-y-5 pb-4 pt-5">
					{transcript.loading && !closed && (
						<div className="flex min-h-32 items-center justify-center">
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					)}

					{((!transcript.loading && transcript.missing) || closed) && (
						<EmptyFeedback
							icon={SquareTerminal}
							title={closed ? "Pane fechado" : "Comece a conversa"}
							subtitle={emptyHint()}
							{...(!closed &&
								!shell && {
									actionText: syncTranscript.isPending
										? "Sincronizando..."
										: "Sincronizar conversa",
									actionPending: syncTranscript.isPending,
									onAction: () => syncTranscript.mutate({ paneId }),
								})}
						/>
					)}

					{!closed &&
						!transcript.loading &&
						!transcript.missing &&
						transcript.events.length === 0 && (
							<EmptyFeedback
								icon={SquareTerminal}
								title="Conversa vazia"
								subtitle="Envie uma mensagem para começar. Ela aparecerá aqui quando o agente a registrar."
							/>
						)}

					{!closed && (
						<LinkCwdProvider {...(cwd ? { cwd } : {})}>
							<SessionTimeline
								key={paneId}
								events={transcript.events}
								busy={!!busy}
								{...(agent ? { agent: agent.agent } : {})}
							/>
						</LinkCwdProvider>
					)}
				</div>
			</div>

			<div className="relative shrink-0 px-2 sm:px-4">
				{!pinned && (
					<Button
						variant="outline"
						size="sm"
						onClick={stickToEnd}
						className="absolute -top-11 left-1/2 z-20 -translate-x-1/2 bg-background shadow-md"
					>
						<ArrowDown className="size-4" />
						Ir para o fim
					</Button>
				)}

				{inTransit && (
					<div
						role="status"
						data-component="model-switch-status"
						className="mx-auto flex w-full max-w-3xl items-center gap-2 border border-border bg-card px-3 py-2 text-xs shadow-sm"
					>
						<Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
						<span className="min-w-0 truncate">{switchingHint}</span>
					</div>
				)}

				<ThreadComposer
					draftKey={`kowork-radar-draft-${paneId}`}
					{...(agent?.projectName ? { projectName: agent.projectName } : {})}
					{...(agent ? { cli: agent.agent } : {})}
					accessory={
						!closed &&
						!shell && (
							<ModelPicker
								catalog={catalog.data}
								session={session}
								value={target}
								onChange={setChoice}
								disabled={!!busy || inTransit}
							/>
						)
					}
					helperText={
						busy
							? "Envie orientações enquanto o agent trabalha, sem interromper a execução."
							: `Ctrl+Enter envia · / abre o menu do ${cli.label} · cole imagens.`
					}
					disabled={closed || inTransit || !agent || !transcript.connected || !!blocked}
					pending={confirming || send.isPending || sendShell.isPending || switchModel.isPending}
					disabledHintInline
					hint={composerHint()}
					onSubmit={submit}
				/>
			</div>
		</div>
	);
}
