import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
	searchQuery: z.string().optional(),
});

export const Route = createFileRoute("/_app/vault/")({
	validateSearch: (search) => searchSchema.parse(search),
});
