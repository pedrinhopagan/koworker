import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/executar/")({
	beforeLoad: () => {
		throw redirect({ to: "/terminals", replace: true });
	},
});
