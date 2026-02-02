import { useMutation } from "@tanstack/react-query";
import { safeInvoke } from "../../../../services/tauri";
import { trpc } from "../../../../services/trpc";
import type { TaskFull, TaskStatus } from "../../../../types";

interface UpdateTaskFullParams {
	projectPath: string;
	task: TaskFull;
}

interface UpdateTaskStatusParams {
	taskId: string;
	status: TaskStatus;
}

interface TerminalActionParams {
	action:
		| "launch_project"
		| "focus"
		| "structure"
		| "execute_all"
		| "execute_subtask"
		| "review"
		| "commit";
	projectId: string;
	taskId?: string;
	subtaskId?: string;
}

export function useUpdateTaskFullMutation() {
	const utils = trpc.useUtils();

	const mutation = trpc.tasks.saveFull.useMutation({
		onSuccess: (_, variables) => {
			utils.tasks.invalidate();
			if (variables?.id) {
				utils.tasks.get.invalidate({ id: variables.id });
				utils.tasks.getFull.invalidate({ id: variables.id });
			}
		},
	});

	return {
		...mutation,
		mutate: (
			{ task }: UpdateTaskFullParams,
			options?: { onSuccess?: (savedTask: TaskFull) => void },
		) => {
			const taskToSave: TaskFull = {
				...task,
				modified_at: new Date().toISOString(),
				modified_by: "user",
			};
			mutation.mutate(taskToSave, {
				onSuccess: () => options?.onSuccess?.(taskToSave),
			});
		},
		mutateAsync: async ({ task }: UpdateTaskFullParams) => {
			const taskToSave: TaskFull = {
				...task,
				modified_at: new Date().toISOString(),
				modified_by: "user",
			};
			await mutation.mutateAsync(taskToSave);
			return taskToSave;
		},
	};
}

export function useUpdateTaskStatusMutation(taskId: string) {
	const utils = trpc.useUtils();

	const mutation = trpc.tasks.updateStatus.useMutation({
		onSuccess: () => {
			utils.tasks.invalidate();
			utils.tasks.get.invalidate({ id: taskId });
			utils.tasks.getFull.invalidate({ id: taskId });
		},
	});

	return {
		...mutation,
		mutate: ({ taskId: id, status }: UpdateTaskStatusParams) => {
			mutation.mutate({ id, status });
		},
		mutateAsync: ({ taskId: id, status }: UpdateTaskStatusParams) => {
			return mutation.mutateAsync({ id, status });
		},
	};
}

export function useTerminalActionMutation() {
	return useMutation({
		mutationFn: async ({ action, projectId, taskId, subtaskId }: TerminalActionParams) => {
			await safeInvoke("terminal_action", { action, projectId, taskId, subtaskId });
		},
	});
}

export function useLaunchQuickfixMutation() {
	return useMutation({
		mutationFn: async ({ taskId, prompt }: { taskId: string; prompt: string }) => {
			await safeInvoke("send_quickfix", { taskId, prompt });
		},
	});
}
