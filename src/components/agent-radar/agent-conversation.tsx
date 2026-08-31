import { useMutation } from "@tanstack/react-query";
import { ArrowDown, Loader2, SquareTerminal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { agentCliVisual } from "@/components/agent-radar/agent-cli";
import { AgentSwitcherStrip } from "@/components/agent-radar/agent-list";
import { SessionTimeline } from "@/components/agent-session/session-timeline";
import { ThreadComposer } from "@/components/agent-session/thread-composer";
import { Button } from "@/components/ui/button";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { useAgentRadarTranscript } from "@/hooks/use-agent-radar-transcript";
import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";
import { errorMessage } from "@/lib/orpc-errors";
import { PaneStatusStrip } from "@/components/agent-radar/pane-status-strip";
import { LinkCwdProvider } from "@/components/link-cwd";

export function AgentConversationView({ paneId }: { paneId: string }) {
	const viewport = useRef<HTMLDivElement>(null);
	const content = useRef<HTMLDivElement>(null);
	// O grude no fim é decidido a cada quadro de rolagem, então mora numa ref: virar estado a cada
	// evento de scroll redesenhava a conversa inteira enquanto o dedo ainda estava na tela.
	const anchored = useRef(true);
	const [pinned, setPinned] = useState(true);
	const isMobile = useIsMobileViewport();
	const { agents, loading: radarLoading } = useAgentRadar();
	const agent = agents.find((candidate) => candidate.paneId === paneId) ?? null;
	const transcript = useAgentRadarTranscript(paneId);
	const cli = agent
		? agentCliVisual(agent.agent)
		: { label: "Agent", icon: SquareTerminal, tone: "text-muted-foreground" };
	const closed = !agent && !radarLoading;
	const busy = agent?.status === "working";
	const blocked = agent?.status === "blocked";

	const send = useMutation({
		...orpc.agentRadar.send.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível responder ao agent")),
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
		window.visualViewport?.addEventListener("resize", follow);

		return () => {
			observer.disconnect();
			window.visualViewport?.removeEventListener("resize", follow);
		};
	}, [scrollToEnd]);

	useEffect(() => {
		stickToEnd();
	}, [paneId, stickToEnd]);

	return (
		<div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-muted/10">
			{isMobile && <AgentSwitcherStrip agents={agents} selectedPaneId={paneId} />}

			<PaneStatusStrip agent={agent} closed={closed} model={transcript.model} />

			<div
				ref={viewport}
				data-component="conversation-viewport"
				onScroll={(event) => {
					const node = event.currentTarget;
					const atEnd = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
					if (atEnd !== anchored.current) {
						anchored.current = atEnd;
						setPinned(atEnd);
					}
				}}
				className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4"
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

				<ThreadComposer
					draftKey={`kowork-radar-draft-${paneId}`}
					{...(agent?.projectName ? { projectName: agent.projectName } : {})}
					{...(agent ? { cli: agent.agent } : {})}
					currentModel={transcript.model}
					modelSwitchDisabled={!!busy}
					helperText={
						busy
							? "Envie orientações enquanto o agent trabalha, sem interromper a execução."
							: `Ctrl+Enter envia · / abre o menu do ${cli.label} · cole imagens.`
					}
					disabled={closed}
					pending={send.isPending}
					disabledHintInline
					onCommand={async (command: string) => {
						try {
							await send.mutateAsync({ paneId, text: command });
							return true;
						} catch {
							return false;
						}
					}}
					hint="Este pane foi fechado."
					onSubmit={async (text) => {
						stickToEnd();
						try {
							await send.mutateAsync({ paneId, text });
							return true;
						} catch {
							return false;
						}
					}}
				/>
			</div>
		</div>
	);
}
