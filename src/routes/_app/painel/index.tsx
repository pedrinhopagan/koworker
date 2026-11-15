import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/painel/")({
	beforeLoad: () => {
		throw redirect({ to: "/projetos", replace: true });
	},
});
