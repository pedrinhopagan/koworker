import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ListChecks, WifiOff } from "lucide-react";

import { orpc } from "@/client";
import { TaskItem } from "@/components/tasks/TaskItem";
import { Text } from "@/components/typography";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { relativeTimeFrom } from "@/lib/relative-time";
import { HomeSectionHeader } from "./home-section-header";

export function HomeRecentTasks({ projectId }: { projectId: string }) {
	const {
		data: tasks = [],
		isLoading,
		isError,
		refetch,
	} = useQuery(orpc.tasks.recent.queryOptions({ input: { projectId } }));

	return (
		<section aria-labelledby="recent-tasks-title" data-component="home-recent-tasks">
			<HomeSectionHeader
				id="recent-tasks-title"
				icon={ListChecks}
				title="Últimas tarefas"
				count={tasks.length}
			>
				<Link
					to="/tarefas"
					search={{ projectId }}
					className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					Ver tarefas <ArrowUpRight className="size-3.5" />
				</Link>
			</HomeSectionHeader>

			{isLoading && <Text tone="muted">Carregando últimas tarefas...</Text>}
			{isError && (
				<EmptyFeedback
					icon={WifiOff}
					title="Não foi possível carregar as tarefas"
					actionText="Tentar de novo"
					onAction={() => void refetch()}
				/>
			)}
			{!isLoading && !isError && tasks.length === 0 && (
				<EmptyFeedback
					icon={ListChecks}
					title="Nenhuma tarefa neste projeto"
					subtitle="As tarefas tocadas aparecem aqui, incluindo as concluídas."
					className="border border-dashed border-border"
				/>
			)}
			{tasks.length > 0 && (
				<div className="overflow-hidden rounded-xl divide-y divide-border border border-border bg-card shadow-xs">
					{tasks.map((task) => (
						<div
							key={task.id}
							data-task-id={task.id}
							data-done={task.done}
							data-last-touched-at={task.lastTouchedAt}
							className="flex min-w-0 items-center gap-3 pr-3"
						>
							<div className="min-w-0 flex-1">
								<TaskItem task={task} variant="compact" />
							</div>
							<Text
								as="span"
								size="xs"
								tone="muted"
								className="w-24 shrink-0 text-right tabular-nums"
							>
								{relativeTimeFrom(task.lastTouchedAt)}
							</Text>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
