import { useEffect } from "react";
import { safeListen } from "../../../../services/tauri";
import { trpc } from "../../../../services/trpc";
import { useDbRefetchStore } from "../../../../stores/dbRefetch";
import type {
	ProjectWithConfig,
	Task,
	TaskExecution,
	TaskFull,
	TaskUpdatedPayload,
} from "../../../../types";

export const TASK_FULL_QUERY_KEY = ["taskFull"] as const;
export const TASK_EXECUTION_QUERY_KEY = ["taskExecution"] as const;

interface UseGetTaskFullQueryOptions {
	taskId: string;
}

interface TaskFullQueryResult {
	task: Task | null;
	taskFull: TaskFull | null;
	project: ProjectWithConfig | null;
	projectPath: string | null;
	activeExecution: TaskExecution | null;
	isLoading: boolean;
	isError: boolean;
	refetch: () => void;
}

export function useGetTaskFullQuery({ taskId }: UseGetTaskFullQueryOptions): TaskFullQueryResult {
	const utils = trpc.useUtils();
	const changeCounter = useDbRefetchStore((s) => s.changeCounter);
	const lastChange = useDbRefetchStore((s) => s.lastChange);

	const taskQuery = trpc.tasks.get.useQuery(
		{ id: taskId },
		{
			enabled: !!taskId,
			staleTime: 30_000,
			refetchOnMount: "always",
		},
	);

	const task = taskQuery.data ?? null;

	const projectId = task?.project_id ?? "";
	const projectQuery = trpc.projects.get.useQuery(
		{ id: projectId },
		{
			enabled: !!task?.project_id,
			staleTime: 60_000,
		},
	);

	const project = (projectQuery.data ?? null) as ProjectWithConfig | null;
	const projectPath = project?.path ?? null;

	const taskFullQuery = trpc.tasks.getFull.useQuery(
		{ id: taskId },
		{
			enabled: !!taskId,
			staleTime: 30_000,
			refetchOnMount: "always",
		},
	);

	const executionQuery = trpc.executions.getActiveForTask.useQuery(
		{ taskId },
		{
			enabled: !!taskId,
			staleTime: 5_000,
			refetchOnMount: "always",
			refetchInterval: 10_000,
		},
	);

	useEffect(() => {
		if (changeCounter === 0) return;

		const isRelevant =
			!lastChange || lastChange.entity_type === "task" || lastChange.entity_type === "subtask";

		const isThisTask = !lastChange || lastChange.entity_id === taskId;

		if (isRelevant && isThisTask) {
			utils.tasks.get.invalidate({ id: taskId });
			utils.tasks.getFull.invalidate({ id: taskId });
			utils.executions.getActiveForTask.invalidate({ taskId });
		}
	}, [changeCounter, lastChange, taskId, utils]);

	useEffect(() => {
		let unlistenTask: (() => void) | null = null;
		let unlistenExecution: (() => void) | null = null;

		safeListen<TaskUpdatedPayload>("task-updated", (event) => {
			if (event.payload.task_id === taskId && event.payload.source === "ai") {
				utils.tasks.get.invalidate({ id: taskId });
				utils.tasks.getFull.invalidate({ id: taskId });
			}
		}).then((fn) => {
			unlistenTask = fn;
		});

		safeListen<TaskExecution>("execution-changed", (event) => {
			if (event.payload.task_id === taskId) {
				utils.executions.getActiveForTask.invalidate({ taskId });
				if (event.payload.status === "completed" || event.payload.status === "error") {
					utils.tasks.getFull.invalidate({ id: taskId });
				}
			}
		}).then((fn) => {
			unlistenExecution = fn;
		});

		return () => {
			unlistenTask?.();
			unlistenExecution?.();
		};
	}, [taskId, utils]);

	const refetch = () => {
		utils.tasks.get.invalidate({ id: taskId });
		utils.tasks.getFull.invalidate({ id: taskId });
		utils.executions.getActiveForTask.invalidate({ taskId });
	};

	const isLoading = taskQuery.isLoading || projectQuery.isLoading || taskFullQuery.isLoading;
	const isError = taskQuery.isError || projectQuery.isError || taskFullQuery.isError;

	return {
		task: task as Task | null,
		taskFull: taskFullQuery.data ?? null,
		project,
		projectPath,
		activeExecution: executionQuery.data ?? null,
		isLoading,
		isError,
		refetch,
	};
}
