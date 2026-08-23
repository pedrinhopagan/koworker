import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";

import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/sonner";
import { FONTS } from "@/lib/constants/fonts";
import { useFontStore } from "@/stores/fonts";
import { useThemeStore } from "@/stores/theme";

interface RouterContext {
	queryClient: QueryClient;
	nested?: boolean;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: RootComponent,
});

function RootComponent() {
	const nested = Route.useRouteContext({ select: (context) => context.nested === true });
	const { theme } = useThemeStore();
	const { uiFont, readingFont } = useFontStore();

	// Em <html> para a cascata alcançar o <body> (que está acima do root React)
	// e os portais montados em document.body (toasts, popovers).
	useEffect(() => {
		const root = document.documentElement;
		root.style.setProperty("--app-font", FONTS[uiFont].family);
		root.style.setProperty("--reading-font", FONTS[readingFont].family);
	}, [uiFont, readingFont]);

	if (nested) {
		return <Outlet />;
	}

	return (
		<div className={theme} data-theme-root>
			<div className="h-dvh flex flex-col bg-background border-l border-[#141414] pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
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
