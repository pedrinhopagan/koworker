import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppShell } from "@/routes/_app/-components/app-shell";

export const Route = createFileRoute("/_app")({
	beforeLoad: () => {
		return { user: { id: 1, name: "Pedro", user_type: "admin" as const } };
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
