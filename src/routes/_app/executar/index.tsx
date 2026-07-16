import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { usePromptBarStore } from "@/stores/prompt-bar";
import { ExecutionComposer } from "./-components/execution-composer";
import { ActiveExecutions, RecentExecutions } from "./-components/execution-history";

const executionSearchSchema = z.object({
	projectId: z.string().optional(),
	taskId: z.string().optional(),
	runId: z.string().optional(),
});

export const Route = createFileRoute("/_app/executar/")({
	validateSearch: (search) => executionSearchSchema.parse(search),
	component: ExecutePage,
});

function ExecutePage() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();
	const { projects, selectedProjectId } = useProjectFocus();
	const cli = usePromptBarStore((state) => state.cli);
	const [projectId, setProjectId] = useState(search.projectId ?? selectedProjectId ?? "");
	const [taskId, setTaskId] = useState(search.taskId ?? "");
	const [createTask, setCreateTask] = useState(false);
	const [taskTitle, setTaskTitle] = useState("");
	const [text, setText] = useState(() => localStorage.getItem("kowork-execution-draft") ?? "");
	const [inputKind, setInputKind] = useState<"text" | "audio_transcript">("text");

	useEffect(() => {
		if (!projectId && selectedProjectId) {
			setProjectId(selectedProjectId);
		}
	}, [projectId, selectedProjectId]);

	useEffect(() => {
		const timer = setTimeout(() => localStorage.setItem("kowork-execution-draft", text), 300);
		return () => clearTimeout(timer);
	}, [text]);

	const tasksQuery = useQuery({
		...orpc.tasks.listByProject.queryOptions({ input: { projectId } }),
		enabled: !!projectId,
	});
	const runsQuery = useQuery({
		...orpc.prompt.listRuns.queryOptions({ input: { limit: 50 } }),
		refetchInterval: (query) =>
			query.state.data?.some((run) => run.status === "running") ? 2500 : false,
	});

	const selectedTask = tasksQuery.data?.find((task) => task.id === taskId);
	const selectedProject = projects.find((project) => project.id === projectId);
	const canSubmit = !!projectId && !!text.trim() && (!createTask || !!taskTitle.trim());

	async function refreshRuns(runId?: string) {
		await queryClient.invalidateQueries({ queryKey: orpc.prompt.listRuns.key() });
		if (runId) {
			await navigate({
				search: { projectId, ...(taskId && !createTask ? { taskId } : {}), runId },
				replace: true,
			});
		}
	}

	const executeMutation = useMutation({
		...orpc.prompt.execute.mutationOptions(),
		onSuccess: async ({ runId }) => {
			setText("");
			localStorage.removeItem("kowork-execution-draft");
			setInputKind("text");
			await refreshRuns(runId);
			toast.success("Execução despachada");
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const retryMutation = useMutation({
		...orpc.prompt.retry.mutationOptions(),
		onSuccess: ({ runId }) => void refreshRuns(runId),
		onError: (error: Error) => toast.error(error.message),
	});
	const cancelMutation = useMutation({
		...orpc.prompt.cancel.mutationOptions(),
		onSuccess: () => void refreshRuns(),
		onError: (error: Error) => toast.error(error.message),
	});
	const clearMutation = useMutation({
		...orpc.prompt.clearRuns.mutationOptions(),
		onSuccess: ({ cleared }) => {
			void refreshRuns();
			toast.success(
				cleared === 1
					? "Execução removida do histórico"
					: `${cleared} execuções removidas do histórico`,
			);
		},
		onError: (error: Error) => toast.error(error.message),
	});

	function handleProjectChange(value: string) {
		setProjectId(value);
		setTaskId("");
		void navigate({ search: { projectId: value }, replace: true });
	}

	function handleSubmit() {
		if (!selectedProject || !canSubmit) {
			return;
		}

		const prompt = selectedTask
			? `${cli === "codex" ? "$kw" : "/kw"} ${selectedTask.folderPath}/${selectedTask.fileNames[0] ?? "index.md"}\n\n${text.trim()}`
			: text.trim();
		executeMutation.mutate({
			clientRequestId: crypto.randomUUID(),
			projectId,
			...(createTask ? { createTaskTitle: taskTitle.trim() } : taskId ? { taskId } : {}),
			prompt,
			originalPrompt: text.trim(),
			source: "execution_route",
			interactionMode: "unattended",
			inputKind,
			cli,
		});
	}

	const orderedRuns = useMemo(() => {
		const runs = runsQuery.data ?? [];
		if (!search.runId) {
			return runs;
		}
		return [...runs].sort(
			(a, b) => Number(b.runId === search.runId) - Number(a.runId === search.runId),
		);
	}, [runsQuery.data, search.runId]);
	const activeRuns = orderedRuns.filter((run) => run.status === "running");
	const recentRuns = orderedRuns.filter((run) => run.status !== "running");
	const historyPending =
		retryMutation.isPending || cancelMutation.isPending || clearMutation.isPending;

	return (
		<PageShell
			title="Executar"
			description="Despache trabalho não assistido e acompanhe o resultado de qualquer dispositivo."
			icon={Smartphone}
			contentClassName="overflow-y-auto pb-24"
		>
			<div className="grid gap-7 pb-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:items-start">
				<div className="order-2 lg:order-1 lg:row-span-2">
					<ExecutionComposer
						projects={projects}
						projectId={projectId}
						tasks={tasksQuery.data ?? []}
						taskId={taskId}
						createTask={createTask}
						taskTitle={taskTitle}
						text={text}
						cli={cli}
						selectedTask={selectedTask}
						canSubmit={canSubmit}
						pending={executeMutation.isPending}
						executorStatus={
							runsQuery.isError ? "unavailable" : runsQuery.isSuccess ? "available" : "checking"
						}
						onProjectChange={handleProjectChange}
						onTaskChange={(value) => {
							setTaskId(value);
							setCreateTask(false);
						}}
						onTaskClear={() => setTaskId("")}
						onCreateTaskChange={() => {
							setCreateTask((value) => !value);
							setTaskId("");
						}}
						onTaskTitleChange={setTaskTitle}
						onTextChange={(value) => {
							setText(value);
							setInputKind("text");
						}}
						onTranscribed={(value) => {
							setText(value);
							setInputKind("audio_transcript");
						}}
						onSubmit={handleSubmit}
					/>
				</div>

				<div className="order-1 lg:order-2">
					<ActiveExecutions
						runs={activeRuns}
						loading={runsQuery.isLoading}
						pending={historyPending}
						onCancel={(runId) => cancelMutation.mutate({ runId })}
					/>
				</div>
				<div className="order-3 lg:order-3">
					<RecentExecutions
						runs={recentRuns}
						pending={historyPending}
						onRetry={(runId) =>
							retryMutation.mutate({ runId, clientRequestId: crypto.randomUUID() })
						}
						onClear={(runIds) => clearMutation.mutate({ runIds })}
					/>
				</div>
			</div>
		</PageShell>
	);
}
