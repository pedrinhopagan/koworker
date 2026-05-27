import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/client";

export interface TaskMetrics {
	total: number;
	pending: number;
	done: number;
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
		done: 0,
	};

	const progress = metrics.total > 0 ? Math.round((metrics.done / metrics.total) * 100) : 0;

	return {
		metrics,
		isLoading,
		progress,
		pendingCount: metrics.pending,
	};
}
