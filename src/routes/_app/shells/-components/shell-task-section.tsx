import { ChevronRight, ListTree } from "lucide-react";

import type { TerminalWorkspaceEntry } from "@/api/schemas/terminal-workspace";
import { AgentCliIcon } from "@/components/agent-radar/agent-cli";
import { Text } from "@/components/typography";
import { RadarStatusMark } from "@/components/ui/radar-status-mark";
import { AGENT_RADAR_STATUS_LABELS } from "@/constants/agent-radar";
import { useRadarAgentNav } from "@/hooks/use-radar-agent-nav";
import { AGENT_RADAR_VISUALS } from "@/lib/agent-radar-status";
import { cn } from "@/lib/utils";
import { groupTerminalWorkspaceTasks } from "./shell-groups";

export function ShellTaskSection({
	entries,
	onSelect,
}: {
	entries: TerminalWorkspaceEntry[];
	onSelect: (key: string) => void;
}) {
	const { openTask } = useRadarAgentNav();
	const tasks = groupTerminalWorkspaceTasks(entries);

	if (tasks.length === 0) {
		return null;
	}

	return (
		<section data-component="shell-task-section" className="mb-3 border-b border-border pb-3">
			<div className="mb-1 flex items-center gap-2 px-3 py-1">
				<ListTree className="size-3.5 shrink-0 text-primary" />
				<Text
					as="span"
					size="xs"
					className="min-w-0 flex-1 truncate font-bold uppercase tracking-wider"
				>
					Tarefas em andamento
				</Text>
				<Text as="span" size="xs" tone="faint" className="font-mono text-[9px]">
					{tasks.length}
				</Text>
			</div>

			<ul className="space-y-1">
				{tasks.map((task) => (
					<li
						key={task.taskId}
						data-slot="task"
						className="mx-2 border border-border bg-card shadow-[inset_3px_0_0_var(--project-accent,var(--primary))]"
					>
						<button
							type="button"
							onClick={() => openTask(task.taskId, task.projectId)}
							className="flex w-full items-center gap-2 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
						>
							<span className="min-w-0 flex-1">
								<Text as="span" size="xs" className="block truncate font-semibold">
									{task.taskTitle ?? "Tarefa sem título"}
								</Text>
								{task.projectName && (
									<Text
										as="span"
										size="xs"
										tone="muted"
										className="block truncate font-mono text-[10px]"
									>
										{task.projectName}
									</Text>
								)}
							</span>
							<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
						</button>

						<div className="flex flex-wrap gap-1 border-t border-border/60 px-2 py-1.5">
							{task.agents.map((agent) => {
								const visual = AGENT_RADAR_VISUALS[agent.status];

								return (
									<button
										key={agent.key}
										type="button"
										onClick={() => onSelect(agent.key)}
										aria-label={`Abrir conversa · ${AGENT_RADAR_STATUS_LABELS[agent.status]}`}
										className={cn(
											"flex min-h-9 items-center gap-1.5 border px-2 font-mono text-[10px] font-bold uppercase tracking-wider",
											visual.badge,
										)}
									>
										<AgentCliIcon agent={agent.agent ?? "agent"} className="size-3.5" />
										<RadarStatusMark status={agent.status} />
										{AGENT_RADAR_STATUS_LABELS[agent.status]}
									</button>
								);
							})}
						</div>
					</li>
				))}
			</ul>
		</section>
	);
}
