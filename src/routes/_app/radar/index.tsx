import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/radar/")({
	beforeLoad: () => {
		throw redirect({ to: "/shells", replace: true });
	},
});
