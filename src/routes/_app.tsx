import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { orpc } from "@/client";
import { AppShell } from "@/components/layout/app-shell";

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
