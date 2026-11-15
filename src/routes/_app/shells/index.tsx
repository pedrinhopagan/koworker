import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
	tab: z.string().optional(),
});

export const Route = createFileRoute("/_app/shells/")({
	validateSearch: searchSchema,
	beforeLoad: ({ search }) => {
		const paneId = search.tab?.startsWith("agent:") ? search.tab.slice(6) : undefined;
		throw redirect({ to: "/chat", search: { paneId: paneId || undefined }, replace: true });
	},
});
