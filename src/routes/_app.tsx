import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { orpc } from "@/client";
import { AppShell } from "@/components/layout/app-shell";
import { useTaskSyncEvents } from "@/hooks/use-task-sync-events";
import { useTerminalEvents } from "@/hooks/use-terminal-events";

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
	useTerminalEvents();
	useTaskSyncEvents();

	return (
		<AppShell>
			<Outlet />
		</AppShell>
	);
}
