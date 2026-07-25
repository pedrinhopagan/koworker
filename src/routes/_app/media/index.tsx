import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
	page: z.coerce.number().int().min(1).optional().default(1),
});

export const Route = createFileRoute("/_app/media/")({
	validateSearch: (search) => searchSchema.parse(search),
});
