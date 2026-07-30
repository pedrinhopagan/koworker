import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/radar/$paneId/")({
	beforeLoad: ({ params }) => {
		throw redirect({ to: "/terminals/$paneId", params, replace: true });
	},
});
