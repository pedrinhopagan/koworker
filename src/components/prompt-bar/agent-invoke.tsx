import { useQuery } from "@tanstack/react-query";
import { Bot, Play } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { useAgentsQuery } from "@/hooks/use-agents";
import { buildKoworkerPrompt } from "@/lib/build-prompt";
import { LucideIcon } from "@/lib/lucide-icon";
import { recordPromptHistory } from "@/lib/prompt-history";
import { executeInTerminal } from "@/lib/terminal";
import { cn } from "@/lib/utils";
import { usePromptBarStore } from "@/stores/prompt-bar";
import type { TaskAgent } from "@/types/agents";

const triggerBase =
	"flex h-6 w-6 items-center justify-center transition-colors disabled:opacity-40";

// Botão-toggle do Grupo 1: clicar abre o menu de agents; com um agent ativo, clicar de novo
// desativa. Fica disabled fora de rota que anexa `/kw` (mas segue clicável pra desativar se já
// houver um agent escolhido).
export function AgentPickerButton({
	selected,
	onSelect,
	onClear,
	canPick,
}: {
	selected: TaskAgent | null;
	onSelect: (agent: TaskAgent) => void;
	onClear: () => void;
	canPick: boolean;
}) {
	const { taskAgents, isLoading } = useAgentsQuery();

	if (selected) {
		return (
			<Tooltip label={`Agent ativo: ${selected.label} — clique para desativar`}>
				<button
					type="button"
					aria-label="Desativar agent"
					onClick={onClear}
					className={cn(triggerBase, "text-primary hover:text-primary/80")}
				>
					<Bot className="h-3.5 w-3.5" />
				</button>
			</Tooltip>
		);
	}

	return (
		<DropdownMenu>
			<Tooltip label={canPick ? "Invocar agent nesta rota" : "Disponível em rotas de leitura .md"}>
				<DropdownMenuTrigger
					aria-label="Escolher agent"
					disabled={!canPick}
					className={cn(triggerBase, "text-muted-foreground hover:text-foreground")}
				>
					<Bot className="h-3.5 w-3.5" />
				</DropdownMenuTrigger>
			</Tooltip>
			<DropdownMenuContent align="start" side="top" className="max-h-80 w-72 overflow-y-auto">
				<DropdownMenuLabel>Invocar agent</DropdownMenuLabel>
				{taskAgents.length === 0 ? (
					<div className="px-2 py-1.5 text-xs text-muted-foreground">
						{isLoading ? "Carregando..." : "Nenhum agent cadastrado"}
					</div>
				) : (
					taskAgents.map((agent) => (
						<DropdownMenuItem
							key={agent.slug}
							onSelect={() => onSelect(agent)}
							className="flex items-center gap-2"
						>
							<div
								className="flex h-6 w-6 shrink-0 items-center justify-center border bg-muted/30"
								style={{ borderColor: agent.color, color: agent.color }}
							>
								<LucideIcon name={agent.icon} className="size-3.5" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="truncate text-sm text-foreground">{agent.label}</div>
								<div className="truncate text-xs text-muted-foreground">{agent.description}</div>
							</div>
						</DropdownMenuItem>
					))
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// Botão de ação do Grupo 3, ao lado de "Copiar prompt": dispara o agent ativo numa nova aba tmux
// da sessão do projeto DONO do `.md` (não o em foco), com `/kw <target> + texto`.
export function AgentInvokeButton({
	agent,
	target,
	projectName,
	onInvoked,
}: {
	agent: TaskAgent;
	target: string | null;
	projectName?: string;
	onInvoked: () => void;
}) {
	const projectsQuery = useQuery(orpc.projects.list.queryOptions());

	function handleInvoke() {
		if (!target) return;

		const project = projectsQuery.data?.find((p) => p.name === projectName);
		if (!project) {
			toast.error("Projeto da rota não encontrado");
			return;
		}

		const text = usePromptBarStore.getState().text;
		const prompt = buildKoworkerPrompt({ target, text });

		void executeInTerminal(
			{ id: project.id, name: project.name, mainRoute: project.mainRoute },
			{ id: `agent_${agent.slug}`, title: agent.label },
			prompt,
			{ agent: agent.slug, forceNew: true },
		);

		recordPromptHistory({
			kind: "agent",
			text,
			prompt,
			target,
			agentSlug: agent.slug,
			projectId: project.id,
			projectName: project.name,
		});

		onInvoked();
	}

	return (
		<Tooltip
			label={`Invocar ${agent.label} numa nova aba do terminal`}
			triggerClassName="inline-flex shrink-0"
		>
			<Button size="sm" variant="secondary" disabled={!target} onClick={handleInvoke}>
				<Play size={14} />
				Invocar agent
			</Button>
		</Tooltip>
	);
}
