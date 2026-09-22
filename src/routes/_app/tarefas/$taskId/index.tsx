import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const routeSearchSchema = z.object({
	projectId: z.string().optional(),
	q: z.string().optional(),
	includeCompleted: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/_app/tarefas/$taskId/")({
	validateSearch: routeSearchSchema,
});
