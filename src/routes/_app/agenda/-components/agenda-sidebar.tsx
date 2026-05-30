import { ListTodo } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { TaskItem } from "@/components/tasks/TaskItem";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { useSelectedProjectStore } from "@/stores/selected-project";
import { useAgendaBacklog } from "../-utils/use-agenda-backlog";

export function AgendaSidebar() {
	const selectedProjectId = useSelectedProjectStore((s) => s.selectedProjectId);
	const { tasks, loading } = useAgendaBacklog(selectedProjectId ?? null);

	return (
		<aside className="flex min-h-0 flex-col gap-2 border-r border-border pr-4">
			<div className="flex items-center justify-between">
				<Title as="span" size="sm" className="uppercase tracking-[0.12em]">
					Backlog
				</Title>
				<Text as="span" size="xs" tone="muted">
					{tasks.length}
				</Text>
			</div>

			<div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
				{!loading && tasks.length === 0 && (
					<EmptyFeedback
						icon={ListTodo}
						title="Sem tarefas no backlog"
						subtitle="Tarefas pendentes ainda não agendadas aparecem aqui"
					/>
				)}
				{tasks.map((task) => (
					<TaskItem key={task.id} task={task} variant="compact" />
				))}
			</div>
		</aside>
	);
}
