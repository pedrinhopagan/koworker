import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";

import { ErrorBoundary } from "@/components/error-boundary";
import { FONTS } from "@/lib/constants/fonts";
import { useFontStore } from "@/stores/fonts";
import { useThemeStore } from "@/stores/theme";

interface RouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: RootComponent,
});

function RootComponent() {
	const { theme } = useThemeStore();
	const { uiFont, readingFont } = useFontStore();

	// Em <html> para a cascata alcançar o <body> (que está acima do root React)
	// e os portais montados em document.body (toasts, popovers).
	useEffect(() => {
		const root = document.documentElement;
		root.style.setProperty("--app-font", FONTS[uiFont].family);
		root.style.setProperty("--reading-font", FONTS[readingFont].family);
	}, [uiFont, readingFont]);

	return (
		<div className={theme} data-theme-root>
			<div className="h-screen flex flex-col bg-background border-0 md:border-4 md:border-[#141414]">
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					<ErrorBoundary>
						<Outlet />
					</ErrorBoundary>
				</div>
			</div>
		</div>
	);
}
