import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TaskForm } from "./-components/task-form";
import { TaskList } from "./-components/task-list";
import { TaskSearch } from "./-components/task-search";
import { VaultPanel } from "./-components/vault-panel";
import { useCreateTask } from "./-utils/use-create-task";
import { useTasksData } from "./-utils/use-tasks-data";

const rawSearchSchema = z.object({
	q: z.string().optional(),

	// Canonical (preferred)
	projectId: z.string().optional(),
	taskTypeId: z.string().optional(),
	priorityId: z.string().optional(),
	includeCompleted: z.coerce.boolean().optional(),

	// Legacy (PT-BR) — kept for backwards compatibility
	projetoId: z.string().optional(),
	categoriaId: z.string().optional(),
	prioridadeId: z.string().optional(),
});

const searchSchema = z.object({
	q: z.string().optional(),
	projectId: z.string().optional(),
	taskTypeId: z.string().optional(),
	priorityId: z.string().optional(),
	includeCompleted: z.boolean().optional(),
});

export const Route = createFileRoute("/_app/tarefas/")({
	validateSearch: (search) => {
		const raw = rawSearchSchema.parse(search);
		return searchSchema.parse({
			q: raw.q,
			projectId: raw.projectId ?? raw.projetoId,
			taskTypeId: raw.taskTypeId ?? raw.categoriaId,
			priorityId: raw.priorityId ?? raw.prioridadeId,
			includeCompleted: raw.includeCompleted,
		});
	},
	component: TarefasPage,
});

function TarefasPage() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const { data, loading } = useTasksData(search);
	const { createTask, loading: createLoading } = useCreateTask();
	const [view, setView] = useState<"tasks" | "vault">("tasks");

	function handleSearchChange(next: {
		q?: string;
		taskTypeId?: string;
		priorityId?: string;
		includeCompleted?: boolean;
	}) {
		navigate({
			search: (prev) => ({
				...prev,
				q: next.q,
				taskTypeId: next.taskTypeId,
				priorityId: next.priorityId,
				includeCompleted: next.includeCompleted,
			}),
			replace: true,
		});
	}

	return (
		<PageShell
			title="Tarefas"
			description={`${data.pendingCount} pendentes, ${data.executedCount} concluídas`}
			icon={CheckCircle2}
		>
			<div className="flex h-full min-h-0 flex-col gap-4">
				<div className="flex gap-1">
					{(["tasks", "vault"] as const).map((option) => (
						<Button
							key={option}
							variant={view === option ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setView(option)}
							className={cn(view !== option && "text-muted-foreground")}
						>
							{option === "tasks" ? "Tarefas" : "Vault"}
						</Button>
					))}
				</div>

				{view === "tasks" ? (
					<>
						<TaskForm onSubmit={createTask} loading={createLoading} />
						<TaskSearch
							value={{
								q: search.q,
								taskTypeId: search.taskTypeId,
								priorityId: search.priorityId,
								includeCompleted: search.includeCompleted,
							}}
							categories={data.categories}
							priorities={data.priorities}
							onChange={handleSearchChange}
						/>

						<div className="min-h-0 flex-1 overflow-y-auto pr-2 pb-6">
							<TaskList tasks={data.tasks} loading={loading} />
						</div>
					</>
				) : (
					<div className="min-h-0 flex-1 overflow-y-auto pr-2 pb-6">
						<VaultPanel />
					</div>
				)}
			</div>
		</PageShell>
	);
}
