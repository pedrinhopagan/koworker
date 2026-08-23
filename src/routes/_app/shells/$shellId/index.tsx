import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/shells/$shellId/")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/shells",
			search: { tab: params.shellId },
			replace: true,
		});
	},
});
