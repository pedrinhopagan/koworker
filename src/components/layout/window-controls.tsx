import { Copy, Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Tooltip } from "@/components/ui/tooltip";
import {
	hideWindow,
	isDesktop,
	isWindowMaximized,
	minimizeWindow,
	onWindowMaximizedChange,
	toggleMaximize,
} from "@/lib/desktop";
import { cn } from "@/lib/utils";
import { getWindowToggleShortcutTooltip } from "@/lib/window-shortcut";

const control =
	"flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:bg-muted/60";

export function WindowControls() {
	const [maximized, setMaximized] = useState(false);

	useEffect(() => {
		if (!isDesktop()) {
			return;
		}
		void isWindowMaximized().then(setMaximized);
		return onWindowMaximizedChange(setMaximized);
	}, []);

	if (!isDesktop()) {
		return null;
	}

	return (
		<div className="ml-1 flex h-full items-stretch self-stretch border-l border-border">
			<Tooltip label="Minimizar">
				<button type="button" className={control} onClick={minimizeWindow} aria-label="Minimizar">
					<Minus className="size-4" />
				</button>
			</Tooltip>
			<Tooltip label={maximized ? "Restaurar" : "Maximizar"}>
				<button
					type="button"
					className={control}
					onClick={() => void toggleMaximize().then(setMaximized)}
					aria-label={maximized ? "Restaurar" : "Maximizar"}
				>
					{maximized ? <Copy className="size-3.5" /> : <Square className="size-3.5" />}
				</button>
			</Tooltip>
			<Tooltip label={`Esconder janela — ${getWindowToggleShortcutTooltip()}`}>
				<button
					type="button"
					className={cn(control, "hover:bg-destructive hover:text-destructive-foreground")}
					onClick={hideWindow}
					aria-label="Esconder janela"
				>
					<X className="size-4" />
				</button>
			</Tooltip>
		</div>
	);
}
