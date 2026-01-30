import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Calendar } from "lucide-react";

import { DashboardHeader } from "./-components/dashboard-header";
import { HomeSidebar } from "./-components/home-sidebar";
import { ProjectsSection } from "./-components/projects-section";
import { QuickLinks } from "./-components/quick-links";
import { SectionHeader } from "./-components/section-header";
import { TaskListSection } from "./-components/task-list-section";
import { WeekCalendar } from "./-components/week-calendar";
import { useHomeData, MAX_VISIBLE_TASKS } from "./-utils/use-home-data";

const searchSchema = z.object({
	foco: z.enum(["semana", "mes"]).optional(),
	q: z.string().optional(),
});

export const Route = createFileRoute("/_app/")({
	validateSearch: (search) => searchSchema.parse(search),
	component: HomePage,
});

function HomePage() {
	const { tasks, projects, loading } = useHomeData();

	const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
	const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);

	// Get display tasks (pending first, then in execution)
	const displayTasks = useMemo(() => {
		const pending = tasks.filter((t) => t.status === "pending");
		const inExecution = tasks.filter((t) => t.status === "in_execution");
		return [...inExecution, ...pending].slice(0, MAX_VISIBLE_TASKS);
	}, [tasks]);

	// Auto-select first task
	useEffect(() => {
		if (displayTasks.length > 0 && selectedTaskId === null) {
			setSelectedTaskId(displayTasks[0].id);
		}
	}, [displayTasks, selectedTaskId]);

	const selectedTask = useMemo(() => {
		if (!selectedTaskId) return null;
		return tasks.find((t) => t.id === selectedTaskId) ?? null;
	}, [tasks, selectedTaskId]);

	const handleTaskClick = useCallback(
		(taskId: string) => {
			if (selectedTaskId === taskId) {
				window.location.href = "/tarefas";
			} else {
				setSelectedTaskId(taskId);
			}
		},
		[selectedTaskId],
	);

	const handleProjectClick = useCallback((projectId: string) => {
		window.location.href = `/tarefas?projetoId=${projectId}`;
	}, []);

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<DashboardHeader />

			<main className="flex-1 flex overflow-hidden">
				{/* Left sidebar - 1/3 width */}
				<div className="w-1/3 min-w-[280px] max-w-[380px] border-r border-border overflow-y-auto">
					<HomeSidebar
						selectedTask={selectedTask}
						tasks={tasks}
						selectedDate={selectedDate}
						selectedTaskId={selectedTaskId}
						onTaskSelect={setSelectedTaskId}
					/>
				</div>

				{/* Right content - 2/3 width */}
				<div className="flex-1 overflow-y-auto p-6 space-y-6">
					<TaskListSection
						tasks={displayTasks}
						loading={loading}
						selectedTaskId={selectedTaskId}
						onTaskClick={handleTaskClick}
					/>

					<ProjectsSection projects={projects} onProjectClick={handleProjectClick} />

					<section>
						<SectionHeader
							title="Minha Semana"
							icon={Calendar}
							linkTo="/agenda"
							linkLabel="ver agenda"
							accentColor="hsl(var(--primary))"
						/>
						<WeekCalendar
							tasks={tasks}
							selectedDate={selectedDate}
							onDateSelect={setSelectedDate}
						/>
					</section>

					<section>
						<QuickLinks tasks={tasks} />
					</section>
				</div>
			</main>
		</div>
	);
}
