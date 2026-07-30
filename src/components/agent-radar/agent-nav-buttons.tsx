import { ListTodo, ListTree } from "lucide-react";

import { Tooltip } from "@/components/ui/tooltip";
import { useRadarAgentNav } from "@/hooks/use-radar-agent-nav";
import { cn } from "@/lib/utils";

type AgentNavButtonsProps = {
	projectId: string | null;
	projectName: string | null;
	taskId: string | null;
	taskTitle: string | null;
	className?: string;
	buttonClassName?: string;
	showOpenTask?: boolean;
};

const buttonClass =
	"relative inline-flex size-7 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground";

export function AgentNavButtons({
	projectId,
	projectName,
	taskId,
	taskTitle,
	className,
	buttonClassName,
	showOpenTask = true,
}: AgentNavButtonsProps) {
	const { openProjectTasks, openTask } = useRadarAgentNav();
	const canOpenTask = showOpenTask && Boolean(taskId);
	const canOpenProject = Boolean(projectId);

	if (!canOpenTask && !canOpenProject) {
		return null;
	}

	return (
		<div className={cn("flex shrink-0 items-center gap-0.5", className)}>
			{canOpenTask && taskId && (
				<Tooltip label={taskTitle ? `Abrir tarefa · ${taskTitle}` : "Abrir tarefa"}>
					<button
						type="button"
						onClick={function () {
							openTask(taskId, projectId);
						}}
						aria-label={taskTitle ? `Abrir tarefa · ${taskTitle}` : "Abrir tarefa"}
						className={cn(buttonClass, buttonClassName)}
					>
						<ListTree className="size-3.5 text-primary" aria-hidden />
					</button>
				</Tooltip>
			)}

			{canOpenProject && projectId && (
				<Tooltip label={projectName ? `Ver tarefas de ${projectName}` : "Ver tarefas do projeto"}>
					<button
						type="button"
						onClick={function () {
							openProjectTasks(projectId);
						}}
						aria-label={projectName ? `Ver tarefas de ${projectName}` : "Ver tarefas do projeto"}
						className={cn(buttonClass, buttonClassName)}
					>
						<ListTodo className="size-3.5" aria-hidden />
					</button>
				</Tooltip>
			)}
		</div>
	);
}
