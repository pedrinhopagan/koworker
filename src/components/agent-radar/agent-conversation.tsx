import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDown, Loader2, SquareTerminal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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

export function AgentConversationView({ paneId }: { paneId: string }) {
	const viewport = useRef<HTMLDivElement>(null);
	const content = useRef<HTMLDivElement>(null);
	// O grude no fim é decidido a cada quadro de rolagem, então mora numa ref: virar estado a cada
	// evento de scroll redesenhava a conversa inteira enquanto o dedo ainda estava na tela.
	const anchored = useRef(true);
	const [pinned, setPinned] = useState(true);
	const { agents, loading: radarLoading } = useAgentRadar();
	const agent = agents.find((candidate) => candidate.paneId === paneId) ?? null;
	const transcript = useAgentRadarTranscript(paneId);
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

	const send = useMutation({
		...orpc.agentRadar.send.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível responder ao agent")),
	});
	const switchModel = useMutation({
		...orpc.agentRadar.switchModel.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível trocar o modelo")),
	});
	const sendKeys = useMutation({
		...orpc.agentRadar.sendKeys.mutationOptions(),
		onError: (error) =>
			toast.error(errorMessage(error, "Não foi possível controlar o prompt do terminal")),
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

	// Responder a pergunta pelo PWA é dirigir o seletor do CLI às cegas: o cursor nasce na primeira
	// opção, então a opção escolhida vira N descidas e um Enter. Vale só para escolha única — seleção
	// múltipla e texto livre precisam ser respondidos no terminal.
	const answerQuestion = useCallback(
		(questionId: string, input: { answers: string[]; freeText?: string }) => {
			const event = transcript.events.find(
				(candidate) =>
					candidate.payload.kind === "question" && candidate.payload.questionId === questionId,
			);
			if (!event || event.payload.kind !== "question") {
				return;
			}

			const chosen = input.answers[0];
			const index = event.payload.options.findIndex((option) => option.label === chosen);
			if (event.payload.multiSelect || input.freeText || input.answers.length !== 1 || index < 0) {
				toast.info("Responda esta pergunta diretamente no terminal");
				return;
			}

			sendKeys.mutate({
				paneId,
				keys: [...Array.from({ length: index }, () => "Down" as const), "Enter" as const],
			});
		},
		[transcript.events, sendKeys, paneId],
	);

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

	return (
		<div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-muted/10">
			<PaneStatusStrip agent={agent} closed={closed} model={transcript.model} />

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
							subtitle={
								closed
									? "A central encerrou envio e transcript deste pane."
									: "Envie a primeira mensagem abaixo. Se a sessão já existia, sincronize o histórico."
							}
							{...(!closed && {
								actionText: syncTranscript.isPending ? "Sincronizando..." : "Sincronizar conversa",
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
								subtitle="A primeira fala aparecerá quando o transcript nativo registrá-la."
							/>
						)}

					{!closed && (
						<LinkCwdProvider {...(agent?.cwd ? { cwd: agent.cwd } : {})}>
							<SessionTimeline
								key={paneId}
								events={transcript.events}
								busy={!!busy}
								{...(agent ? { agent: agent.agent } : {})}
								{...(blocked ? { onAnswer: answerQuestion } : {})}
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
						!closed && (
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
					disabled={closed || inTransit}
					pending={send.isPending || switchModel.isPending}
					disabledHintInline
					hint={closed ? "Este pane foi fechado." : switchingHint}
					onSubmit={submit}
				/>
			</div>
		</div>
	);
}
