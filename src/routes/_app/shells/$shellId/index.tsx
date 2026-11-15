import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/shells/$shellId/")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/chat",
			search: {
				paneId: params.shellId.startsWith("agent:")
					? params.shellId.slice(6) || undefined
					: undefined,
			},
			replace: true,
		});
	},
});
