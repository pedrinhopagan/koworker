import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/routes/_app/-components/app-shell";
import { orpc } from "@/client";

export const Route = createFileRoute("/_app")({
	beforeLoad: async ({ context }) => {
		try {
			const user = await context.queryClient.ensureQueryData(orpc.auth.me.queryOptions());
			return { user };
		} catch {
			throw redirect({ to: "/login" });
		}
	},

	component: AppLayout,
});

function AppLayout() {
	return (
		<AppShell>
			<Outlet />
		</AppShell>
	);
}
