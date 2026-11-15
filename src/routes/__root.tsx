import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toast";
import { useVisualViewport } from "@/hooks/use-visual-viewport";
import { useThemeStore } from "@/stores/theme";

interface RouterContext {
	queryClient: QueryClient;
	nested?: boolean;
	routeProjectId?: string;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: RootComponent,
});

function RootComponent() {
	const nested = Route.useRouteContext({ select: (context) => context.nested === true });
	const theme = useThemeStore((state) => state.theme);
	const palette = useThemeStore((state) => state.palette);

	if (nested) {
		return <Outlet />;
	}

	return <RootViewport className={`${theme} ${palette}`} />;
}

function RootViewport({ className }: { className: string }) {
	useVisualViewport();

	return (
		<div className={className} data-theme-root>
			<div
				data-component="app-viewport"
				className="relative top-[var(--app-viewport-top,0px)] h-[var(--app-viewport-height,100dvh)] flex flex-col bg-background pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
			>
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					<ErrorBoundary>
						<Outlet />
					</ErrorBoundary>
				</div>
				<Toaster />
			</div>
		</div>
	);
}
