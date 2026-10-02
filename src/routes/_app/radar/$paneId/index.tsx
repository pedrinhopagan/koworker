import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/radar/$paneId/")({
	beforeLoad: ({ params }) => {
		throw redirect({ to: "/shells", search: { tab: `agent:${params.paneId}` }, replace: true });
	},
});
