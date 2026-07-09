import { ArrowLeft, ArrowRight, RefreshCw, StopCircle } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useCanGoBack } from "@tanstack/react-router";

import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";

type NavigationApi = {
	canGoForward?: boolean;
};

function canGoForward() {
	const navigation = (window as Window & { navigation?: NavigationApi }).navigation;
	return navigation?.canGoForward === true;
}

function canStopLoading() {
	return document.readyState !== "complete";
}

export function AppContextMenu({ children }: { children: ReactNode }) {
	const canGoBack = useCanGoBack();
	const [forwardEnabled, setForwardEnabled] = useState(canGoForward);
	const [stopEnabled, setStopEnabled] = useState(canStopLoading);

	useEffect(() => {
		function refreshState() {
			setForwardEnabled(canGoForward());
			setStopEnabled(canStopLoading());
		}

		refreshState();
		window.addEventListener("popstate", refreshState);
		window.addEventListener("pageshow", refreshState);
		window.addEventListener("load", refreshState);

		return () => {
			window.removeEventListener("popstate", refreshState);
			window.removeEventListener("pageshow", refreshState);
			window.removeEventListener("load", refreshState);
		};
	}, []);

	function goBack() {
		window.history.back();
	}

	function goForward() {
		window.history.forward();
	}

	function stopLoading() {
		window.stop();
	}

	function reload() {
		window.location.reload();
	}

	return (
		<ContextMenu
			onOpenChange={(open) => {
				if (open) {
					setForwardEnabled(canGoForward());
					setStopEnabled(canStopLoading());
				}
			}}
		>
			<ContextMenuTrigger asChild>
				<div className="contents">{children}</div>
			</ContextMenuTrigger>
			<ContextMenuContent className="w-[220px] rounded-none">
				<ContextMenuLabel className="truncate px-3 py-2 text-xs font-normal uppercase tracking-wider text-muted-foreground">
					Navegação
				</ContextMenuLabel>
				<ContextMenuItem disabled={!canGoBack} onSelect={goBack} className="px-3 py-2">
					<ArrowLeft className="mr-2 size-4" />
					Voltar
					<ContextMenuShortcut>Alt ←</ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuItem disabled={!forwardEnabled} onSelect={goForward} className="px-3 py-2">
					<ArrowRight className="mr-2 size-4" />
					Avançar
					<ContextMenuShortcut>Alt →</ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuItem disabled={!stopEnabled} onSelect={stopLoading} className="px-3 py-2">
					<StopCircle className="mr-2 size-4" />
					Parar
					<ContextMenuShortcut>Esc</ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem onSelect={reload} className="px-3 py-2">
					<RefreshCw className="mr-2 size-4" />
					Recarregar
					<ContextMenuShortcut>Ctrl R</ContextMenuShortcut>
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
