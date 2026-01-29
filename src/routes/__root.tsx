import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

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
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </div>
  );
}
