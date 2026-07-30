import { Link, useRouterState } from "@tanstack/react-router";
import { Zap } from "lucide-react";

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
		<Link
			to="/executar"
			search={{
				...(projectId ? { projectId } : {}),
				...(taskId ? { taskId } : {}),
			}}
			className="flex min-h-12 min-w-0 flex-1 items-center gap-3 border border-border/80 bg-card px-3 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
		>
			<Zap className="size-4 shrink-0 text-muted-foreground" />
			<span className="min-w-0 flex-1">
				<Text as="span" className="block font-bold">
					Executar
				</Text>
				<Text as="span" className="block truncate text-[11px] text-muted-foreground">
					{taskId
						? "Com o contexto desta tarefa"
						: (target.projectName ?? "Escolha projeto e contexto")}
				</Text>
			</span>
		</Link>
	);
}
