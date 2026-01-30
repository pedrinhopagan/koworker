import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/client";

export interface TaskMetrics {
	total: number;
	pending: number;
	inProgress: number;
	done: number;
	lastModified?: number | null;
}

export function useTaskMetrics(projectId: string | null) {
	const { data, isLoading } = useQuery(
		orpc.tasks.metrics.queryOptions({
			input: { projectId },
		}),
	);

	const metrics: TaskMetrics = data ?? {
		total: 0,
		pending: 0,
		inProgress: 0,
		done: 0,
		lastModified: null,
	};

	const progress = metrics.total > 0 ? Math.round((metrics.done / metrics.total) * 100) : 0;

	// Alias for pending count (pending + inProgress)
	const pendingCount = metrics.pending + metrics.inProgress;

	return {
		metrics,
		isLoading,
		progress,
		pendingCount,
	};
}
