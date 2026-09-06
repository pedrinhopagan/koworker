import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
	path: z.string().min(1),
	line: z.coerce.number().int().positive().optional(),
});

export const Route = createFileRoute("/_app/arquivo/")({
	validateSearch: searchSchema,
});
