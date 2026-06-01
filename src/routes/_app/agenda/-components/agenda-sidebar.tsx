import { ListTodo } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { useSelectedProjectStore } from "@/stores/selected-project";
import { useAgendaBacklog } from "../-utils/use-agenda-backlog";
import { AgendaBacklogTask } from "./agenda-backlog-task";

export function AgendaSidebar() {
	const selectedProjectId = useSelectedProjectStore((s) => s.selectedProjectId);
	const { groups, total, loading } = useAgendaBacklog(selectedProjectId);

	return (
		<aside className="flex min-h-0 flex-col gap-3 border-r border-border pr-4">
			<div className="flex items-center justify-between">
				<Title as="span" size="sm" className="uppercase tracking-[0.12em]">
					Backlog
				</Title>
				<Text as="span" size="xs" tone="muted">
					{total}
				</Text>
			</div>

			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
				{!loading && total === 0 && (
					<EmptyFeedback
						icon={ListTodo}
						title="Sem tarefas no backlog"
						subtitle="Tarefas pendentes ainda não agendadas aparecem aqui"
					/>
				)}

				{groups.map((group) => (
					<div key={group.id} className="flex flex-col gap-1">
						<div className="flex items-center gap-2 px-1">
							<span
								className="size-2 shrink-0 rounded-full"
								style={{ backgroundColor: group.color }}
							/>
							<Text
								as="span"
								size="xs"
								tone="muted"
								className="min-w-0 flex-1 truncate uppercase tracking-[0.12em]"
							>
								{group.name}
							</Text>
							<Text as="span" size="xs" tone="muted">
								{group.tasks.length}
							</Text>
						</div>

						{group.tasks.map((task) => (
							<AgendaBacklogTask key={task.id} task={task} />
						))}
					</div>
				))}
			</div>
		</aside>
	);
}
