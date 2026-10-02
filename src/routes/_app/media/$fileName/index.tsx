import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
	projectId: z.string().min(1),
	taskId: z.string().min(1).optional(),
});

export const Route = createFileRoute("/_app/media/$fileName/")({
	validateSearch: searchSchema,
	beforeLoad: ({ search }) => ({ routeProjectId: search.projectId }),
});
