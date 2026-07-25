import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const executionSearchSchema = z.object({
	projectId: z.string().optional(),
	taskId: z.string().optional(),
});

export const Route = createFileRoute("/_app/executar/")({
	validateSearch: executionSearchSchema,
});
