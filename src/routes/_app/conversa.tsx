import { createFileRoute, redirect } from "@tanstack/react-router";
import { ConversationSearchSchema } from "@/routes/_app/chat";

export const Route = createFileRoute("/_app/conversa")({
	validateSearch: ConversationSearchSchema,
	beforeLoad: ({ search }) => {
		throw redirect({ to: "/chat", search, replace: true });
	},
});
