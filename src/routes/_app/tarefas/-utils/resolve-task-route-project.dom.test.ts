import { describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";

import { orpc } from "@/client";
import { resolveTaskRouteProject } from "./resolve-task-route-project";
import { NO_FEATURE_ROUTE_ID } from "./task-route-resolution";

const taskId = "11111111-1111-1111-1111-111111111111";
const featureId = "22222222-2222-2222-2222-222222222222";

function setupQueries() {
	const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
	queryClient.setQueryData(orpc.tasks.getFull.queryKey({ input: { id: taskId } }), {
		id: taskId,
		projectId: "projeto-da-tarefa",
		folderPath: ".koworker/tarefa",
		title: undefined,
		displayTitle: "Tarefa",
		titleFromContent: false,
		groupId: featureId,
		displayOrder: 0,
		done: false,
		completedAt: undefined,
		createdAt: 0,
		updatedAt: undefined,
		deletedAt: undefined,
		lastEditedAt: 0,
		fileNames: [],
		artifactNames: [],
		worktree: null,
		files: [],
		attachments: [],
		project: null,
	});
	queryClient.setQueryData(orpc.tasks.getFull.queryKey({ input: { id: featureId } }), null);
	queryClient.setQueryData(orpc.taskGroups.list.queryKey({ input: {} }), [
		{
			id: featureId,
			projectId: "projeto-da-feature",
			name: "Feature",
			color: "#ffffff",
			displayOrder: 0,
			createdAt: 0,
			updatedAt: undefined,
		},
	]);

	return queryClient;
}

describe("resolveTaskRouteProject", () => {
	test.each([
		{ firstSegment: taskId },
		{ firstSegment: taskId, secondSegment: "index.md" },
		{ firstSegment: featureId, secondSegment: taskId },
		{ firstSegment: NO_FEATURE_ROUTE_ID, secondSegment: taskId },
	])("resolve o projeto real da tarefa em $firstSegment/$secondSegment", async (segments) => {
		expect(
			await resolveTaskRouteProject({
				queryClient: setupQueries(),
				...segments,
				projectId: "projeto-errado",
			}),
		).toBe("projeto-da-tarefa");
	});

	test.each([undefined, "projeto-errado"])(
		"resolve a feature pelo vínculo real quando projectId é %s",
		async (projectId) => {
			expect(
				await resolveTaskRouteProject({
					queryClient: setupQueries(),
					firstSegment: featureId,
					projectId,
				}),
			).toBe("projeto-da-feature");
		},
	);

	test("sem feature precisa do projeto explícito para distinguir a listagem", async () => {
		const queryClient = setupQueries();
		expect(
			await resolveTaskRouteProject({ queryClient, firstSegment: NO_FEATURE_ROUTE_ID }),
		).toBeUndefined();
		expect(
			await resolveTaskRouteProject({
				queryClient,
				firstSegment: NO_FEATURE_ROUTE_ID,
				projectId: "projeto-explícito",
			}),
		).toBe("projeto-explícito");
	});
});
