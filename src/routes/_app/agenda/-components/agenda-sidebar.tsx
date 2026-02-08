import { useDndContext, useDroppable } from "@dnd-kit/core";
import { CalendarClock, ListTodo } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAgendaSidebarTasks } from "../-utils/use-agenda-sidebar-tasks";
import { AgendaSidebarTask } from "./agenda-sidebar-task";

function SidebarSectionHeader({
	title,
	count,
	icon,
}: {
	title: string;
	count: number;
	icon: typeof ListTodo;
}) {
	const Icon = icon;

	return (
		<div className="flex items-center justify-between gap-2">
			<div className="flex items-center gap-2">
				<Icon className="h-4 w-4 text-muted-foreground" />
				<Title
					as="h3"
					size="xs"
					className="font-semibold uppercase tracking-wide text-muted-foreground"
				>
					{title}
				</Title>
			</div>
			<Badge variant="muted" className="h-5 px-2 py-0 text-[10px]">
				{count}
			</Badge>
		</div>
	);
}

export function AgendaSidebar() {
	const { loading, unscheduledTasks, scheduledTasks } = useAgendaSidebarTasks();
	const { active } = useDndContext();
	const activeTask = active?.data.current?.task as { scheduledDate?: string | null } | undefined;
	const canUnscheduleByDrop = Boolean(activeTask?.scheduledDate);

	const { isOver, setNodeRef } = useDroppable({
		id: "agenda-unscheduled-dropzone",
		data: {
			type: "unscheduled-target",
		},
		disabled: !canUnscheduleByDrop,
	});

	return (
		<aside className="min-h-0 min-w-0 overflow-hidden border-t border-border md:border-t-0 md:border-r ">
			<div className="flex h-full flex-col px-4 py-4">
				<div className="mb-4 space-y-1">
					<Title as="h2" size="md">
						Backlog da agenda
					</Title>
					<Text size="xs" tone="muted">
						Arraste tarefas para os dias e organize seu planejamento.
					</Text>
				</div>

				{loading && (
					<div className="flex flex-1 items-center justify-center">
						<Text size="sm" tone="muted">
							Carregando tarefas...
						</Text>
					</div>
				)}

				{!loading && (
					<div className="grid min-h-0 flex-1 grid-rows-[minmax(0,2fr)_minmax(0,1fr)] gap-4 overflow-hidden  pr-1">
						<section ref={setNodeRef} className="relative flex min-h-0 flex-col ">
							<SidebarSectionHeader
								title="Sem agendamento"
								count={unscheduledTasks.length}
								icon={ListTodo}
							/>
							<div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto  pr-1">
								{unscheduledTasks.map((task) => (
									<AgendaSidebarTask key={task.id} task={task} showScheduledDate={false} />
								))}
								{unscheduledTasks.length === 0 && (
									<Text size="xs" tone="muted" className="rounded-md border border-dashed p-3">
										Nenhuma tarefa pendente sem agendamento.
									</Text>
								)}
							</div>
							{canUnscheduleByDrop && (
								<div
									className={cn(
										"pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-md bg-black/60",
										isOver && "bg-black/70",
									)}
								>
									<Text as="span" size="sm" className="font-medium text-white/95">
										Solte aqui para desagendar
									</Text>
								</div>
							)}
						</section>

						<section className="flex min-h-0 flex-col ">
							<SidebarSectionHeader
								title="Com agendamento"
								count={scheduledTasks.length}
								icon={CalendarClock}
							/>
							<div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto  pr-1">
								{scheduledTasks.map((task) => (
									<AgendaSidebarTask key={task.id} task={task} showScheduledDate />
								))}
								{scheduledTasks.length === 0 && (
									<Text size="xs" tone="muted" className="rounded-md border border-dashed p-3">
										Nenhuma tarefa pendente com agendamento.
									</Text>
								)}
							</div>
						</section>
					</div>
				)}
			</div>
		</aside>
	);
}
