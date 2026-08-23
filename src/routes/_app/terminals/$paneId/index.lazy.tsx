import { useMutation } from "@tanstack/react-query";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowLeft,
	GitCompare,
	MoreVertical,
	Pencil,
	RefreshCw,
	Square,
	SquareTerminal,
	Target,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { agentCliVisual } from "@/components/agent-radar/agent-cli";
import { AgentConversationView } from "@/components/agent-radar/agent-conversation";
import { AgentSidebar } from "@/components/agent-radar/agent-sidebar";
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
import { Input } from "@/components/ui/input";
import { AGENT_RADAR_STATUS_LABELS } from "@/constants/agent-radar";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { errorMessage } from "@/lib/orpc-errors";
import { cn } from "@/lib/utils";

export const Route = createLazyFileRoute("/_app/terminals/$paneId/")({
	component: TerminalPanePage,
});

function TerminalPanePage() {
	const { paneId } = Route.useParams();
	const [renaming, setRenaming] = useState(false);
	const [renameLabel, setRenameLabel] = useState("");
	const [confirmingClose, setConfirmingClose] = useState(false);
	const { agents, focus: radarFocus } = useAgentRadar();
	const agent = agents.find((candidate) => candidate.paneId === paneId) ?? null;
	const cli = agent
		? agentCliVisual(agent.agent)
		: { label: "Agent", icon: SquareTerminal, tone: "text-muted-foreground" };
	const busy = agent?.status === "working";
	const blocked = agent?.status === "blocked";

	const interrupt = useMutation({
		...orpc.agentRadar.interrupt.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível interromper o agent")),
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

				<AgentConversationView paneId={paneId} />
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
