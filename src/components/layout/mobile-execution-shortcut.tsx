import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Zap } from "lucide-react";

import { Text } from "@/components/typography";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { useRouteDocTarget } from "@/hooks/use-route-doc-target";

export function MobileExecutionShortcut() {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const target = useRouteDocTarget();
	const { selectedProjectId } = useProjectFocus();
	const projectId = target.projectId ?? selectedProjectId ?? undefined;
	const taskId = target.kind === "task" && target.projectId ? target.taskId : undefined;
	if (pathname.startsWith("/executar")) {
		return null;
	}

	return (
		<div className="border-t border-border bg-chrome px-2 py-1.5 md:hidden">
			<Link
				to="/executar"
				search={{
					...(projectId ? { projectId } : {}),
					...(taskId ? { taskId } : {}),
				}}
				className="flex min-h-10 items-center gap-3 border border-border/80 bg-card px-3 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			>
				<Zap className="size-4 text-muted-foreground" />
				<span className="min-w-0 flex-1">
					<Text className="font-bold">Executar agora</Text>
					<Text className="truncate text-[11px] text-muted-foreground">
						{taskId
							? "Com o contexto desta tarefa"
							: (target.projectName ?? "Escolha projeto e contexto")}
					</Text>
				</span>
				<ChevronRight className="size-4 text-muted-foreground" />
			</Link>
		</div>
	);
}
