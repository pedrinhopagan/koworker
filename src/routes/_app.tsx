import { ORPCError } from "@orpc/client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { orpc } from "@/client";
import { AppShell } from "@/components/layout/app-shell";
import { useNavigateEvents } from "@/hooks/use-navigate-events";
import { useTasksRealtime } from "@/hooks/use-tasks-realtime";
import { useTerminalEvents } from "@/hooks/use-terminal-events";

export const Route = createFileRoute("/_app")({
	beforeLoad: async ({ context }) => {
		try {
			const user = await context.queryClient.ensureQueryData({
				...orpc.auth.me.queryOptions(),
				retry: (failureCount, error) =>
					failureCount < 10 &&
					!(
						error instanceof ORPCError &&
						(error.code === "UNAUTHORIZED" || error.code === "FORBIDDEN")
					),
				retryDelay: 300,
			});

			return { user };
		} catch (error) {
			// FORBIDDEN aqui é sempre o portão de dispositivo: a senha estava certa, o aparelho é que
			// ainda não foi liberado no PC.
			if (error instanceof ORPCError && error.code === "FORBIDDEN") {
				throw redirect({ to: "/dispositivo" });
			}

			throw redirect({ to: "/login" });
		}
	},

	component: AppLayout,
});

function AppLayout() {
	const nested = Route.useRouteContext({ select: (context) => context.nested === true });

	if (nested) {
		return <Outlet />;
	}

	return <AppChrome />;
}

function AppChrome() {
	useTerminalEvents();
	useTasksRealtime();
	useNavigateEvents();

	return (
		<AppShell>
			<Outlet />
		</AppShell>
	);
}
