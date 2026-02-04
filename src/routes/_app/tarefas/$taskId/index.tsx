import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { TaskAcceptanceCriteria } from "./-components/task-acceptance-criteria";
import { TaskActionPanel } from "./-components/task-action-panel";
import { TaskDescription } from "./-components/task-description";
import { TaskDetails } from "./-components/task-details";
import { TaskHeader } from "./-components/task-header";
import { TaskMetadata } from "./-components/task-metadata";
import { TaskPageLayout } from "./-components/task-page-layout";
import { TaskSubtasks } from "./-components/task-subtasks";

export const Route = createFileRoute("/_app/tarefas/$taskId/")({
	component: TaskDetailPage,
});

function TaskDetailPage() {
	const { taskId } = Route.useParams();

	const [selectionSkillId, setSelectionSkillId] = useState<string | null>(null);
	const [selectedSubtaskIds, setSelectedSubtaskIds] = useState<string[]>([]);
	const [selectedParentTask, setSelectedParentTask] = useState(false);
	const selectingSubtasks = Boolean(selectionSkillId);

	const taskQuery = useQuery(orpc.tasks.getFull.queryOptions({ input: { id: taskId } }));
	const task = taskQuery.data ?? null;

	function handleStartSubtaskSelection(skillId: string) {
		setSelectionSkillId(skillId);
		setSelectedSubtaskIds([]);
		setSelectedParentTask(false);
	}

	function handleCancelSubtaskSelection() {
		setSelectionSkillId(null);
		setSelectedSubtaskIds([]);
		setSelectedParentTask(false);
	}

	function handleToggleSubtaskSelection(id: string) {
		setSelectedSubtaskIds((prev) =>
			prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
		);
	}

	function handleToggleParentTaskSelection() {
		setSelectedParentTask((prev) => !prev);
	}

	function handleSelectAllSubtasks() {
		const allIds = task?.subtasks?.map((subtask) => subtask.id) ?? [];
		setSelectedSubtaskIds(allIds);
		setSelectedParentTask(true);
	}

	function handleClearSelection() {
		setSelectedSubtaskIds([]);
		setSelectedParentTask(false);
	}

	if (taskQuery.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 size={18} className="animate-spin" />
					<Text size="sm" tone="muted">
						Carregando tarefa...
					</Text>
				</div>
			</div>
		);
	}

	if (!task) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<Text size="sm" tone="muted">
					Tarefa não encontrada.
				</Text>
				<Button variant="outline" asChild>
					<Link to="/tarefas">Voltar para tarefas</Link>
				</Button>
			</div>
		);
	}

	return (
		<TaskPageLayout
			header={<TaskHeader task={task} />}
			sidebar={
				<TaskActionPanel
					task={task}
					selectingSubtasks={selectingSubtasks}
					selectionSkillId={selectionSkillId}
					selectedSubtaskIds={selectedSubtaskIds}
					selectedParentTask={selectedParentTask}
					onStartSubtaskSelection={handleStartSubtaskSelection}
					onCancelSubtaskSelection={handleCancelSubtaskSelection}
				/>
			}
			content={
				<div className="space-y-4">
					<TaskDetails task={task} />
					<TaskSubtasks
						task={task}
						selectionMode={selectingSubtasks}
						selectedIds={selectedSubtaskIds}
						selectedParentTask={selectedParentTask}
						onToggleSelection={handleToggleSubtaskSelection}
						onToggleParentTask={handleToggleParentTaskSelection}
						onSelectAll={handleSelectAllSubtasks}
						onClearSelection={handleClearSelection}
					/>
					<TaskAcceptanceCriteria task={task} />
					<TaskDescription task={task} />
					<TaskMetadata task={task} />
				</div>
			}
		/>
	);
}
