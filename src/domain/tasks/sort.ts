import { deriveTaskAttentionState } from "./attention";

type SortableTask = {
	status: string;
	description?: string | null;
	aiMetadata?: unknown;
	subtasks?: Array<{ status?: string | null }> | null;
	createdAt?: number | null;
	completedAt?: number | null;
};

export function sortTasksByAttention<T extends SortableTask>(tasks: T[]): T[] {
	return tasks
		.map((task, index) => {
			const attention = deriveTaskAttentionState({
				status: task.status,
				description: task.description ?? null,
				aiMetadata: task.aiMetadata as { lastCompletedAction?: string | null } | null,
				subtasks: task.subtasks ?? [],
				completedAt: task.completedAt ?? null,
			});
			return {
				task,
				index,
				attentionPriority: attention.priority,
				createdAt: task.createdAt ?? 0,
			};
		})
		.sort((a, b) => {
			if (a.attentionPriority !== b.attentionPriority) {
				return a.attentionPriority - b.attentionPriority;
			}
			if (a.createdAt !== b.createdAt) {
				return b.createdAt - a.createdAt;
			}
			return a.index - b.index;
		})
		.map((item) => item.task);
}
