import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { orpcWs, type WsRouterOutputs } from "@/client";

type TaskSyncEvent =
	WsRouterOutputs["tasks"]["globalEvents"] extends AsyncIterable<infer Item> ? Item : never;

type QueryKeyInfo = {
	namespace: string;
	procedure: string;
	input: Record<string, unknown> | undefined;
};

function getQueryKeyInfo(queryKey: readonly unknown[]): QueryKeyInfo | null {
	const [rawPath, rawParams] = queryKey;
	if (!Array.isArray(rawPath) || rawPath.length < 2) return null;

	const [namespace, procedure] = rawPath;
	if (typeof namespace !== "string" || typeof procedure !== "string") return null;

	if (!rawParams || typeof rawParams !== "object") {
		return { namespace, procedure, input: undefined };
	}

	const input = "input" in rawParams ? rawParams.input : undefined;
	if (!input || typeof input !== "object") {
		return { namespace, procedure, input: undefined };
	}

	return { namespace, procedure, input: input as Record<string, unknown> };
}

function isProjectScopedTaskQuery(procedure: string) {
	return (
		procedure === "getAll" ||
		procedure === "listByProject" ||
		procedure === "listByDate" ||
		procedure === "listByWeek" ||
		procedure === "focus" ||
		procedure === "metrics"
	);
}

function isTaskQueryAffected(event: TaskSyncEvent, queryKey: readonly unknown[]) {
	const queryKeyInfo = getQueryKeyInfo(queryKey);
	if (!queryKeyInfo || queryKeyInfo.namespace !== "tasks") return false;

	const taskId = queryKeyInfo.input?.id;
	if (
		(queryKeyInfo.procedure === "getById" || queryKeyInfo.procedure === "getFull") &&
		typeof taskId === "string"
	) {
		return taskId === event.taskId;
	}

	if (!isProjectScopedTaskQuery(queryKeyInfo.procedure)) return false;

	const projectId = queryKeyInfo.input?.projectId;
	if (projectId === undefined || projectId === null) return true;
	if (typeof projectId !== "string") return false;
	return projectId === event.projectId;
}

function isSubtaskQueryAffected(event: TaskSyncEvent, queryKey: readonly unknown[]) {
	const queryKeyInfo = getQueryKeyInfo(queryKey);
	if (!queryKeyInfo) return false;
	if (queryKeyInfo.namespace !== "subtasks" || queryKeyInfo.procedure !== "listByTask")
		return false;
	return queryKeyInfo.input?.taskId === event.taskId;
}

async function invalidateAffectedTaskQueries(
	queryClient: ReturnType<typeof useQueryClient>,
	event: TaskSyncEvent,
) {
	await Promise.all([
		queryClient.invalidateQueries({
			predicate: (query) => isTaskQueryAffected(event, query.queryKey),
			refetchType: "active",
		}),
		queryClient.invalidateQueries({
			predicate: (query) => isSubtaskQueryAffected(event, query.queryKey),
			refetchType: "active",
		}),
	]);
}

export function useTaskSyncEvents() {
	const queryClient = useQueryClient();

	useEffect(() => {
		const controller = new AbortController();

		async function subscribe() {
			try {
				const events = await orpcWs.tasks.globalEvents.call(undefined, {
					signal: controller.signal,
				});

				for await (const event of events) {
					if (event.source !== "cli") continue;
					await invalidateAffectedTaskQueries(queryClient, event);
				}
			} catch (error) {
				if (error instanceof Error && error.name === "AbortError") {
					return;
				}
				console.error("[Task Sync] Erro na subscription:", error);
			}
		}

		subscribe();

		return () => {
			controller.abort();
		};
	}, [queryClient]);
}
