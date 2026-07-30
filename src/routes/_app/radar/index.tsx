import { createFileRoute, redirect } from "@tanstack/react-router";

// A central virou `/terminals`, mas notificação push já entregue continua apontando pra cá.
export const Route = createFileRoute("/_app/radar/")({
	beforeLoad: () => {
		throw redirect({ to: "/terminals", replace: true });
	},
});
