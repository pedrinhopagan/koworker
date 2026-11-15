import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowDown, Check, Loader2, SquareTerminal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";

import type { TerminalWorkspaceEntry } from "@/api/schemas/terminal-workspace";
import { orpc } from "@/client";
import { LinkCwdProvider } from "@/components/link-cwd";
import { PaneStatusStrip } from "@/components/agent-radar/pane-status-strip";
import { ModelPicker } from "@/components/agent-session/model-picker";
import { OutgoingPrompts } from "@/components/agent-session/outgoing-prompts";
import { SessionTimeline } from "@/components/agent-session/session-timeline";
import { ThreadComposer } from "@/components/agent-session/thread-composer";
import { Button } from "@/components/ui/button";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { agentRadarAgentLabel, agentRadarCli } from "@/constants/agent-radar";
import { effortLabel } from "@/constants/invoke";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { useAgentRadarTranscript } from "@/hooks/use-agent-radar-transcript";
import { useSessionModel } from "@/hooks/use-session-model";
import { modelOptionLabel } from "@/lib/model-target";
import { nextPendingPrompt, outgoingPrompts } from "@/lib/agent-prompt-receipt";
import { blockingQuestion, lastTurnEnded } from "@/lib/agent-session";
import { errorMessage } from "@/lib/orpc-errors";
import { cn } from "@/lib/utils";
import { clearPromptDraft } from "@/lib/prompt-draft";
import { activePaneMove, usePaneMoves } from "@/stores/pane-moves";
import { NO_PENDING_PROMPTS, usePendingPrompts } from "@/stores/pending-prompts";

const HANDOFF_POLL_MS = 1_500;
const ANSWER_TOP_OFFSET_PX = 44;
// Pane recém-aberto pode chegar à tela antes de o radar anunciá-lo: "fechado" só depois desse
// respiro, senão a conversa nova abre com um aviso de pane morto por um instante.
const CLOSED_SETTLE_MS = 2_500;

function handoffActive(phase: string | undefined) {
	return phase === "compacting" || phase === "starting";
}

function shellChatAgent(agent: string | null | undefined) {
	return agent === "claude" || agent === "codex" || agent === "pi" ? agent : null;
}

function queueHint(agent: string | undefined) {
	if (agent === "claude" || agent === "claude-code") {
		return "↑ no terminal edita a fila";
	}

	return agent === "codex" || agent === "pi" ? "Alt+↑ no terminal traz de volta para editar" : null;
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
	const transcript = useAgentRadarTranscript(paneId);
	const pending = usePendingPrompts((state) => state.prompts[paneId] ?? NO_PENDING_PROMPTS);
	const turnEnded = pending.length === 0 && lastTurnEnded(transcript.events);
	const agent = shell?.agent
		? {
				agent: shell.agent,
				status:
					shell.status === "blocked" || (shell.status === "working" && !turnEnded)
						? shell.status
						: ("idle" as const),
				awaitingInput: shell.status === "blocked",
				changedAt: shell.changedAt,
				activity: null,
				tabLabel: shell.label,
				cwd: shell.cwd,
				projectName: shell.projectName,
			}
		: radarAgent;
	const latestEvents = useRef(transcript.events);
	latestEvents.current = transcript.events;
	const cwd = transcript.source?.cwd ?? agent?.cwd;
	const busy = agent?.status === "working";
	const question = blockingQuestion(transcript.events);
	const blocked = !!agent?.awaitingInput || !!question;
	const shellAgent = shellChatAgent(shell?.agent);

	const latestPending = useRef(pending);
	latestPending.current = pending;
	const addPending = usePendingPrompts((state) => state.add);
	const removePending = usePendingPrompts((state) => state.remove);
	const [now, setNow] = useState(() => Date.now());
	const outgoing = outgoingPrompts({
		pending,
		queued: transcript.queued,
		events: transcript.events,
		busy: !!busy,
		now,
	});
	const delivered = outgoing.delivered.join(",");

	useEffect(() => {
		if (pending.length === 0) {
			return;
		}
		const timer = setInterval(() => setNow(Date.now()), 1_000);

		return () => clearInterval(timer);
	}, [pending.length]);

	useEffect(() => {
		if (delivered) {
			removePending(paneId, delivered.split(","));
		}
	}, [delivered, paneId, removePending]);

	const sessionCli = agentRadarCli(agent?.agent);
	const model = useSessionModel({
		paneId,
		cli: sessionCli,
		transcriptModel: transcript.model,
		transcriptEffort: transcript.effort,
		agentStatus: agent?.status,
	});
	const { target } = model;
	const diff = model.crossCli;

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

	const revealAnswer = useCallback((element: HTMLElement) => {
		anchored.current = false;
		setPinned(false);
		requestAnimationFrame(() => {
			const node = viewport.current;
			if (!node || !node.contains(element)) {
				return;
			}

			const top =
				node.scrollTop +
				element.getBoundingClientRect().top -
				node.getBoundingClientRect().top -
				ANSWER_TOP_OFFSET_PX;
			node.scrollTop = top;
		});
	}, []);

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

	async function deliver(text: string) {
		if (shell) {
			if (!shellAgent) {
				throw new Error("Agente sem chat");
			}
			await sendShell.mutateAsync({
				id: shell.id,
				agent: shellAgent,
				text,
				...(transcript.source ? { sourcePath: transcript.source.path } : {}),
			});

			return;
		}
		await send.mutateAsync({ paneId, text });
	}

	async function submit(text: string) {
		stickToEnd();
		if (!diff) {
			if (!(await model.settle())) {
				return false;
			}
			try {
				await deliver(text);
			} catch {
				return false;
			}
			addPending(
				paneId,
				nextPendingPrompt({
					text,
					events: latestEvents.current,
					pending: latestPending.current,
					now: Date.now(),
				}),
			);

			return true;
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

			if (result.kind === "updated") {
				clearMove(moveKey);
				model.clearChoice();
				return true;
			}
			landMove(moveKey, `agent:${result.paneId}`);
			return true;
		} catch {
			clearMove(moveKey);
			return false;
		}
	}

	const [answering, setAnswering] = useState(false);
	async function answer(questionId: string, input: { answers: string[]; freeText?: string }) {
		const asked = transcript.events.find(
			(event) => event.payload.kind === "question" && event.payload.questionId === questionId,
		)?.payload;
		const reply = [...input.answers, input.freeText].filter(Boolean).join(", ");
		if (asked?.kind !== "question" || !reply) {
			return;
		}

		setAnswering(true);
		try {
			await deliver(`> ${asked.question}\n\n${reply}`);
			toast.success("Resposta enviada ao agente");
		} catch {
			toast.error("Não foi possível enviar a resposta");
		} finally {
			setAnswering(false);
		}
	}

	const latestAnswer = useRef(answer);
	latestAnswer.current = answer;
	const onAnswer = useCallback(
		(questionId: string, input: { answers: string[]; freeText?: string }) =>
			void latestAnswer.current(questionId, input),
		[],
	);

	const targetLabel = agentRadarAgentLabel(move?.cli ?? handoff.data?.cli ?? target.cli);
	const switchingHint =
		move?.to || move?.kind === "reopen"
			? "Abrindo a conversa no novo pane…"
			: handoff.data?.phase === "starting"
				? `Abrindo a sessão ${targetLabel}…`
				: `Resumindo a conversa para continuar no ${targetLabel}…`;
	const inTransit = switching || !!move;
	const sessionOptions = sessionCli ? model.catalog?.[sessionCli] : undefined;
	const modelHint = {
		idle: null,
		applying: `Trocando para ${[modelOptionLabel(sessionOptions, target.model), target.effort && effortLabel(target.effort)].filter(Boolean).join(" · ")} no terminal…`,
		applied: `${[modelOptionLabel(sessionOptions, model.session.model), model.session.effort && effortLabel(model.session.effort)].filter(Boolean).join(" · ")} valendo nesta sessão`,
		failed: "A troca não foi aplicada; o modelo anterior continua",
	}[model.status];
	function composerHint() {
		if (closed) {
			return "Esta sessão foi fechada.";
		}
		if (inTransit) {
			return switchingHint;
		}
		if (blocked) {
			return "O agente espera sua resposta no terminal.";
		}
		return "Conectando à conversa…";
	}
	function emptyHint() {
		if (closed) {
			return "Esta sessão foi encerrada.";
		}
		return "Envie a primeira mensagem. O histórico aparece aqui sozinho assim que o agente gravar a conversa; até lá, o que ele já fez está no terminal.";
	}

	return (
		<div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-muted/10">
			<PaneStatusStrip
				agent={agent}
				closed={closed}
				model={modelOptionLabel(sessionOptions, model.session.model)}
				effort={model.session.effort && effortLabel(model.session.effort)}
			/>
			{onOpenTerminal &&
				(blocked || transcript.missing || (shell && transcript.events.length === 0)) && (
					<div
						role={blocked ? "alert" : undefined}
						className={cn(
							"flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs",
							blocked && "border-warning/40 bg-warning/8",
						)}
					>
						<span className={cn("min-w-0", blocked ? "font-semibold" : "text-muted-foreground")}>
							{question
								? "O agente fez uma pergunta que precisa ser respondida no terminal."
								: blocked
									? "O agente precisa da sua resposta no terminal (permissão, pergunta ou confirmação)."
									: "Permissões, login e comandos interativos ficam no terminal."}
						</span>
						<Button variant="outline" className="min-h-12 shrink-0" onClick={onOpenTerminal}>
							<SquareTerminal className="size-4" />
							Abrir terminal
						</Button>
					</div>
				)}

			<div className="relative min-h-0 flex-1">
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
					className="h-full overflow-y-auto overscroll-contain px-3 sm:px-4"
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
									asyncAnswersOnly
									pending={answering}
									onAnswer={onAnswer}
									onExpandAnswer={revealAnswer}
									{...(agent ? { agent: agent.agent } : {})}
								/>
							</LinkCwdProvider>
						)}

						{!closed && (
							<OutgoingPrompts
								items={outgoing.items}
								queueHint={queueHint(agent?.agent)}
								onDismiss={(id) => removePending(paneId, [id])}
								{...(onOpenTerminal ? { onOpenTerminal } : {})}
							/>
						)}
					</div>
				</div>
				<div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8">
					<div className="absolute inset-0 backdrop-blur-[1px] [mask-image:linear-gradient(to_bottom,black_30%,transparent)]" />
					<div className="absolute inset-0 backdrop-blur-[3px] [mask-image:linear-gradient(to_bottom,black,transparent_60%)]" />
					<div className="absolute inset-0 bg-linear-to-b from-background/70 to-transparent" />
				</div>
			</div>

			<div className="relative shrink-0">
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

				{!inTransit && modelHint && (
					<div
						role="status"
						data-component="model-apply-status"
						data-status={model.status}
						className={cn(
							"mx-auto flex w-full max-w-3xl items-center gap-2 border border-border bg-card px-3 py-2 text-xs shadow-sm animate-in fade-in-0 slide-in-from-bottom-1 duration-200",
							model.status === "failed" && "border-destructive/40 text-destructive",
						)}
					>
						{model.status === "applying" && (
							<Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
						)}
						{model.status === "applied" && <Check className="size-3.5 shrink-0 text-primary" />}
						{model.status === "failed" && <AlertCircle className="size-3.5 shrink-0" />}
						<span className="min-w-0 truncate">{modelHint}</span>
					</div>
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
					edgeToEdge
					{...(agent?.projectName ? { projectName: agent.projectName } : {})}
					{...(agent ? { cli: agent.agent } : {})}
					accessory={
						!closed &&
						sessionCli && (
							<ModelPicker
								catalog={model.catalog}
								session={model.session}
								value={target}
								onChange={model.change}
								status={model.status}
								allowCliChange={!shell}
								disabled={inTransit}
							/>
						)
					}
					helperText={
						busy
							? "O agente está trabalhando: a mensagem entra na fila e é entregue no próximo intervalo, sem interromper."
							: ""
					}
					disabled={closed || inTransit || !agent || !transcript.connected || blocked}
					pending={send.isPending || sendShell.isPending || switchModel.isPending}
					disabledHintInline
					hint={composerHint()}
					onSubmit={submit}
				/>
			</div>
		</div>
	);
}
