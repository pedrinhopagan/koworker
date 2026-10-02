import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { resolveTaskRouteProject } from "../-utils/resolve-task-route-project";

const routeSearchSchema = z.object({
	projectId: z.string().optional(),
	q: z.string().optional(),
	includeCompleted: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/_app/tarefas/$taskId/")({
	validateSearch: routeSearchSchema,
	beforeLoad: async ({ context, params, search }) => {
		const routeProjectId = await resolveTaskRouteProject({
			queryClient: context.queryClient,
			firstSegment: params.taskId,
			projectId: search.projectId,
		});

		if (routeProjectId && routeProjectId !== search.projectId) {
			throw redirect({
				to: "/tarefas/$taskId",
				params,
				search: { ...search, projectId: routeProjectId },
				replace: true,
			});
		}

		return { routeProjectId };
	},
});
