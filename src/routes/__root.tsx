import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useThemeStore } from "@/stores/theme";

interface RouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: RootComponent,
});

function RootComponent() {
	const { theme } = useThemeStore();

	return (
		<div className={theme}>
			{/* Outer container with characteristic border */}
			<div className="h-screen flex flex-col bg-background border-4 border-[#141414]">
				{/* Theme toggle */}
				<div className="fixed top-4 right-4 z-50">
					<ThemeToggle />
				</div>

				{/* Main content area */}
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					<ErrorBoundary>
						<Outlet />
					</ErrorBoundary>
				</div>
			</div>
		</div>
	);
}
