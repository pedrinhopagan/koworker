import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/radar/$paneId/")({
	beforeLoad: ({ params }) => {
		throw redirect({ to: "/chat", search: { paneId: params.paneId }, replace: true });
	},
});
