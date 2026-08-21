import { useMutation } from "@tanstack/react-query";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowDown,
	ArrowLeft,
	GitCompare,
	Loader2,
	MoreVertical,
	Pencil,
	RefreshCw,
	Square,
	SquareTerminal,
	Target,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { agentCliVisual } from "@/components/agent-radar/agent-cli";
import { AgentSwitcherStrip } from "@/components/agent-radar/agent-list";
import { AgentSidebar } from "@/components/agent-radar/agent-sidebar";
import { SessionTimeline } from "@/components/agent-session/session-timeline";
import { ThreadComposer } from "@/components/agent-session/thread-composer";
import { PageShell } from "@/components/layout/page-shell";
import { TaskLink } from "@/components/task-link";
import { Text } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog } from "@/components/ui/dialog";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { Input } from "@/components/ui/input";
import { AGENT_RADAR_STATUS_LABELS } from "@/constants/agent-radar";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { useAgentRadarTranscript } from "@/hooks/use-agent-radar-transcript";
import { errorMessage } from "@/lib/orpc-errors";
import { cn } from "@/lib/utils";
import { PaneStatusStrip } from "../-components/pane-status-strip";
import { TerminalPromptControls } from "../-components/terminal-prompt-controls";

export const Route = createLazyFileRoute("/_app/terminals/$paneId/")({
	component: TerminalPanePage,
});

function TerminalPanePage() {
	const { paneId } = Route.useParams();
	const viewport = useRef<HTMLDivElement>(null);
	const content = useRef<HTMLDivElement>(null);
	// O grude no fim é decidido a cada quadro de rolagem, então mora numa ref: virar estado a cada
	// evento de scroll redesenhava a conversa inteira enquanto o dedo ainda estava na tela.
	const anchored = useRef(true);
	const [pinned, setPinned] = useState(true);
	const [renaming, setRenaming] = useState(false);
	const [renameLabel, setRenameLabel] = useState("");
	const [confirmingClose, setConfirmingClose] = useState(false);
	const { agents, focus: radarFocus, loading: radarLoading } = useAgentRadar();
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
	const interrupt = useMutation({
		...orpc.agentRadar.interrupt.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível interromper o agent")),
	});
	const sendKeys = useMutation({
		...orpc.agentRadar.sendKeys.mutationOptions(),
		onError: (error) =>
			toast.error(errorMessage(error, "Não foi possível controlar o prompt do terminal")),
	});
	const focus = useMutation({
		...orpc.agentRadar.focus.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível focar o agent")),
	});
	const close = useMutation({
		...orpc.agentRadar.close.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível fechar o agent")),
	});
	const openDiff = useMutation({
		...orpc.agentRadar.openDiff.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível abrir o kw-diff")),
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
	const rename = useMutation({
		...orpc.kwTerminal.tabRename.mutationOptions(),
		onSuccess: () => {
			setRenaming(false);
			toast.success("Conversa renomeada");
		},
		onError: (error) => toast.error(errorMessage(error, "Não foi possível renomear a conversa")),
	});

	// Responder a pergunta pelo PWA é dirigir o seletor do CLI às cegas: o cursor nasce na primeira
	// opção, então a opção escolhida vira N descidas e um Enter. Vale só para escolha única — seleção
	// múltipla e texto livre continuam nos controles manuais do prompt.
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
				toast.info("Use os controles do prompt abaixo para responder esta pergunta");
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

	const interruptButton = busy && (
		<Button
			variant="outline"
			size="sm"
			onClick={() => interrupt.mutate({ paneId })}
			disabled={interrupt.isPending}
			className="shrink-0"
		>
			<Square className="size-3.5" />
			Interromper
		</Button>
	);

	const paneMenu = agent && (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" aria-label="Mais ações" className="shrink-0">
					<MoreVertical className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onSelect={() => focus.mutate({ paneId })}>
					<Target className="size-4" />
					Focar no terminal
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={() => openDiff.mutate({ paneId })}>
					<GitCompare className="size-4" />
					Ver mudanças
				</DropdownMenuItem>
				<DropdownMenuItem
					onSelect={() => {
						setRenameLabel(agent.title ?? agent.tabLabel ?? "");
						setRenaming(true);
					}}
				>
					<Pencil className="size-4" />
					Renomear
				</DropdownMenuItem>
				<DropdownMenuItem
					onSelect={() => syncTranscript.mutate({ paneId })}
					disabled={syncTranscript.isPending}
				>
					<RefreshCw className="size-4" />
					Recarregar conversa
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={() => setConfirmingClose(true)} className="text-destructive">
					Fechar
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);

	return (
		<PageShell
			title={cli.label}
			description={agent?.title ?? agent?.tabLabel ?? "A central mostra apenas agents abertos"}
			icon={cli.icon}
			// No celular o cabeçalho da página repetia o que a faixa de conversas e a barra de status já
			// dizem, e comia um sexto da tela: lá quem manda é a barra compacta abaixo.
			headerClassName="mb-0 max-md:hidden"
			contentClassName="flex min-h-0 max-w-none flex-col px-0"
			actions={
				<div className="flex flex-wrap items-center gap-2">
					{agent && (
						<Badge variant={blocked ? "warning" : "muted"}>
							{AGENT_RADAR_STATUS_LABELS[agent.status]}
						</Badge>
					)}
					{agent?.taskId && <TaskLink taskId={agent.taskId} label={agent.taskTitle ?? "Tarefa"} />}
					{interruptButton}
					{paneMenu}
				</div>
			}
		>
			<div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5 md:hidden">
				<Button asChild variant="ghost" size="icon" aria-label="Voltar para a lista de agents">
					<Link to="/terminals">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>

				<div className="flex min-w-0 flex-1 items-center gap-2">
					<cli.icon className={cn("size-4 shrink-0", cli.tone)} />
					<Text as="span" size="sm" className="min-w-0 truncate font-semibold">
						{agent?.taskTitle ?? agent?.title ?? agent?.tabLabel ?? cli.label}
					</Text>
				</div>

				{agent?.taskId && (
					<TaskLink taskId={agent.taskId} label={agent.taskTitle ?? "Tarefa"} compact />
				)}
				{interruptButton}
				{paneMenu}
			</div>

			<div data-component="terminal-conversation-layout" className="flex min-h-0 flex-1">
				<div className="hidden md:flex">
					<AgentSidebar
						agents={agents}
						selectedPaneId={paneId}
						{...(radarFocus.paneId ? { focusedPaneId: radarFocus.paneId } : {})}
					/>
				</div>

				<div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-muted/10">
					<div className="md:hidden">
						<AgentSwitcherStrip agents={agents} selectedPaneId={paneId} />
					</div>

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
										subtitle="A primeira fala aparecerá quando o transcript nativo registrá-la."
									/>
								)}

							{!closed && (
								<SessionTimeline
									key={paneId}
									events={transcript.events}
									busy={!!busy}
									{...(agent ? { agent: agent.agent } : {})}
									{...(blocked ? { onAnswer: answerQuestion } : {})}
								/>
							)}
						</div>
					</div>

					<div className="relative shrink-0 px-4 pb-[env(safe-area-inset-bottom)]">
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

						{blocked && (
							<TerminalPromptControls
								pending={sendKeys.isPending}
								onSend={(keys) => sendKeys.mutate({ paneId, keys })}
							/>
						)}

						<ThreadComposer
							draftKey={`kowork-radar-draft-${paneId}`}
							{...(agent?.projectName ? { projectName: agent.projectName } : {})}
							{...(agent ? { cli: agent.agent } : {})}
							helperText={
								busy
									? "Envie orientações enquanto o agent trabalha, sem interromper a execução."
									: `Ctrl+Enter envia · / abre o menu do ${cli.label} · cole imagens.`
							}
							disabled={closed}
							pending={send.isPending}
							disabledHintInline
							{...(busy
								? {}
								: {
										onCommand: async (command: string) => {
											try {
												await send.mutateAsync({ paneId, text: command });
												return true;
											} catch {
												return false;
											}
										},
									})}
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
			</div>

			<Dialog
				open={renaming}
				onClose={() => setRenaming(false)}
				title="Renomear conversa"
				description="O nome aparece na lista e na faixa de conversas"
				className="max-w-sm bg-card text-card-foreground"
				footer={
					<div className="flex w-full justify-end gap-2">
						<Button variant="outline" size="sm" onClick={() => setRenaming(false)}>
							Cancelar
						</Button>
						<Button
							size="sm"
							disabled={!renameLabel.trim() || rename.isPending}
							onClick={() =>
								agent && rename.mutate({ tabId: agent.tabId, label: renameLabel.trim() })
							}
						>
							{rename.isPending ? "Renomeando..." : "Salvar"}
						</Button>
					</div>
				}
			>
				<Input
					value={renameLabel}
					onChange={(event) => setRenameLabel(event.target.value)}
					placeholder="Nome da conversa"
					maxLength={60}
					onKeyDown={(event) => {
						if (event.key === "Enter" && renameLabel.trim() && agent) {
							rename.mutate({ tabId: agent.tabId, label: renameLabel.trim() });
						}
					}}
				/>
			</Dialog>

			<Dialog
				open={confirmingClose}
				onClose={() => setConfirmingClose(false)}
				title="Fechar esta conversa?"
				description="O agent é encerrado junto com o pane. O histórico continua em /terminals/history."
				className="max-w-sm bg-card text-card-foreground"
				footer={
					<div className="flex w-full justify-end gap-2">
						<Button variant="outline" size="sm" onClick={() => setConfirmingClose(false)}>
							Cancelar
						</Button>
						<Button
							variant="destructive"
							size="sm"
							disabled={close.isPending}
							onClick={() => {
								close.mutate({ paneId }, { onSuccess: () => setConfirmingClose(false) });
							}}
						>
							{close.isPending ? "Fechando..." : "Fechar conversa"}
						</Button>
					</div>
				}
			>
				<Text size="sm" tone="muted">
					{agent?.title ?? agent?.tabLabel ?? "Esta conversa"}
				</Text>
			</Dialog>
		</PageShell>
	);
}
