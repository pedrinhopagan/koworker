import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";

import { Tooltip } from "@/components/ui/tooltip";
import { copyToClipboard } from "@/lib/build-prompt";
import { cn } from "@/lib/utils";

const routeDisplayPaths: Record<string, string> = {
	"/tarefas/$taskId/": "/tarefas/$featureId",
	"/tarefas/$taskId/$file": "/tarefas/$featureId/$taskId",
	"/tarefas/$taskId/$file/$canonicalFile": "/tarefas/$featureId/$taskId/$file",
};

export function RoutePathButton({ className }: { className?: string }) {
	const routePath = useRouterState({
		select: (state) => state.matches.at(-1)?.fullPath ?? "/",
	});
	const displayPath =
		routeDisplayPaths[routePath] ?? (routePath === "/" ? routePath : routePath.replace(/\/$/, ""));

	async function handleCopy() {
		const ok = await copyToClipboard(displayPath);
		toast[ok ? "success" : "error"](ok ? "Rota copiada" : "Falha ao copiar rota");
	}

	return (
		<Tooltip label="Copiar padrão da rota">
			<button
				type="button"
				onClick={() => void handleCopy()}
				className={cn(
					"max-w-72 truncate font-mono text-xs text-muted-foreground/70 transition-colors hover:text-foreground",
					className,
				)}
			>
				{displayPath}
			</button>
		</Tooltip>
	);
}
