import { hashKey, QueryClient, type QueryKey } from "@tanstack/react-query";
import { describe, expect, test } from "bun:test";

import { orpc } from "@/client";
import { shouldInvalidateTaskQuery } from "@/lib/task-query-invalidation";

const event = {
	taskId: "task-1",
	projectId: "project-1",
	action: "updated" as const,
	source: "api" as const,
};

function matchedKeys(queryClient: QueryClient) {
	return queryClient
		.getQueryCache()
		.getAll()
		.filter((query) => shouldInvalidateTaskQuery(query, event))
		.map((query) => query.queryHash);
}

function registerQuery(queryClient: QueryClient, queryKey: QueryKey, data: unknown = {}) {
	queryClient.setQueryData<unknown>(queryKey, data);
}

describe("shouldInvalidateTaskEventQuery", () => {
	test("seleciona somente consultas de tarefas afetadas pelo projeto ou task", () => {
		const queryClient = new QueryClient();
		const affectedProject = orpc.tasks.getAll.queryOptions({
			input: { projectId: "project-1", includeCompleted: false },
		});
		const aggregate = orpc.tasks.metrics.queryOptions({ input: { projectId: null } });
		const otherProject = orpc.tasks.focus.queryOptions({ input: { projectId: "project-2" } });
		const affectedTask = orpc.tasks.getFull.queryOptions({ input: { id: "task-1" } });
		const otherTask = orpc.tasks.getFull.queryOptions({ input: { id: "task-2" } });

		for (const query of [affectedProject, aggregate, otherProject, affectedTask, otherTask]) {
			registerQuery(queryClient, query.queryKey);
		}

		const matches = matchedKeys(queryClient);

		expect(matches).toContain(hashKey(affectedProject.queryKey));
		expect(matches).toContain(hashKey(aggregate.queryKey));
		expect(matches).toContain(hashKey(affectedTask.queryKey));
		expect(matches).not.toContain(hashKey(otherProject.queryKey));
		expect(matches).not.toContain(hashKey(otherTask.queryKey));
	});

	test("não invalida procedures sem relação com listagem ou detalhe", () => {
		const queryClient = new QueryClient();
		const exportContent = orpc.vault.exportContent.queryOptions({
			input: { projectId: "project-1", target: { kind: "task", taskId: "task-1" } },
		});

		registerQuery(queryClient, exportContent.queryKey);

		expect(matchedKeys(queryClient)).toEqual([]);
	});

	test("invalida a galeria de mídia do projeto alterado", () => {
		const queryClient = new QueryClient();
		const affectedMedia = orpc.media.list.queryOptions({
			input: { projectId: "project-1" },
		});
		const aggregateMedia = orpc.media.list.queryOptions({ input: {} });
		const otherMedia = orpc.media.list.queryOptions({
			input: { projectId: "project-2" },
		});

		for (const query of [affectedMedia, aggregateMedia, otherMedia]) {
			registerQuery(queryClient, query.queryKey);
		}

		const matches = matchedKeys(queryClient);

		expect(matches).toContain(hashKey(affectedMedia.queryKey));
		expect(matches).toContain(hashKey(aggregateMedia.queryKey));
		expect(matches).not.toContain(hashKey(otherMedia.queryKey));
	});

	test("usa o projeto do dado em cache quando o watcher não informa taskId", () => {
		const queryClient = new QueryClient();
		const affectedTask = orpc.tasks.getFull.queryOptions({ input: { id: "task-1" } });
		const otherTask = orpc.tasks.getFull.queryOptions({ input: { id: "task-2" } });

		registerQuery(queryClient, affectedTask.queryKey, { projectId: "project-1" });
		registerQuery(queryClient, otherTask.queryKey, { projectId: "project-2" });

		const fsEvent = { ...event, taskId: undefined, source: "fs" as const };
		const matches = queryClient
			.getQueryCache()
			.getAll()
			.filter((query) => shouldInvalidateTaskQuery(query, fsEvent))
			.map((query) => query.queryHash);

		expect(matches).toEqual([hashKey(affectedTask.queryKey)]);
	});
});
