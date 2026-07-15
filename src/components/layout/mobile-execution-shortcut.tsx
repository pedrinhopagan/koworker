import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Zap } from "lucide-react";

import { Text } from "@/components/typography";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { useRouteDocTarget } from "@/hooks/use-route-doc-target";

export function MobileExecutionShortcut() {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const target = useRouteDocTarget();
	const { projects, selectedProjectId } = useProjectFocus();
	const contextProjectId = projects.find((project) => project.name === target.projectName)?.id;
	const projectId = contextProjectId ?? selectedProjectId ?? undefined;
	if (pathname.startsWith("/executar")) {
		return null;
	}

	return (
		<div className="border-t border-border bg-chrome p-2 md:hidden">
			<Link
				to="/executar"
				search={{
					...(projectId ? { projectId } : {}),
					...(target.taskId ? { taskId: target.taskId } : {}),
				}}
				className="flex min-h-11 items-center gap-3 border border-border bg-primary px-3 text-primary-foreground shadow-[2px_2px_0_var(--border)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			>
				<Zap className="size-4" />
				<span className="min-w-0 flex-1">
					<Text className="font-bold">Executar agora</Text>
					<Text className="truncate text-[11px] opacity-75">
						{target.taskId
							? "Com o contexto desta tarefa"
							: (target.projectName ?? "Escolha projeto e contexto")}
					</Text>
				</span>
				<ChevronRight className="size-4" />
			</Link>
		</div>
	);
}
