import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const ConversationSearchSchema = z
	.object({
		id: z.string().uuid().optional(),
		paneId: z.string().min(1).max(200).optional(),
		view: z.literal("new").optional(),
	})
	.refine((search) => !search.id || !search.paneId, "Selecione uma conversa ou um agent.");

export const Route = createFileRoute("/_app/chat/")({
	validateSearch: ConversationSearchSchema,
});
