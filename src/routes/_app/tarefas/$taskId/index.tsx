import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { TASK_COMPLEXITIES } from "@/constants/complexity";

const routeSearchSchema = z.object({
	projectId: z.string().optional(),
	q: z.string().optional(),
	taskTypeId: z.string().optional(),
	priorityId: z.string().optional(),
	complexity: z.enum(TASK_COMPLEXITIES).optional(),
	includeCompleted: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/_app/tarefas/$taskId/")({
	validateSearch: routeSearchSchema,
});
