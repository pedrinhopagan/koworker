import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { resolveTaskRouteProject } from "../-utils/resolve-task-route-project";

const routeSearchSchema = z.object({
	projectId: z.string().optional(),
});

export const Route = createFileRoute("/_app/tarefas/$taskId/$file")({
	validateSearch: routeSearchSchema,
	beforeLoad: async ({ context, params }) => ({
		routeProjectId: await resolveTaskRouteProject({
			queryClient: context.queryClient,
			firstSegment: params.taskId,
			secondSegment: params.file,
		}),
	}),
});
