import { ListTodo, ListTree } from "lucide-react";
import type { ComponentPropsWithoutRef, ElementType } from "react";

import { ContextMenuItem } from "@/components/ui/context-menu";
import { useRadarAgentNav } from "@/hooks/use-radar-agent-nav";

type AgentNavMenuItemsProps = {
	projectId: string | null;
	projectName: string | null;
	taskId: string | null;
	taskTitle: string | null;
	Item?: ElementType<ComponentPropsWithoutRef<typeof ContextMenuItem>>;
};

export function AgentNavMenuItems({
	projectId,
	projectName,
	taskId,
	taskTitle,
	Item = ContextMenuItem,
}: AgentNavMenuItemsProps) {
	const { openProjectTasks, openTask } = useRadarAgentNav();

	return (
		<>
			{taskId && (
				<Item
					onSelect={function () {
						openTask(taskId, projectId);
					}}
				>
					<ListTree className="size-4" />
					{taskTitle ? `Abrir tarefa · ${taskTitle}` : "Abrir tarefa"}
				</Item>
			)}

			{projectId && (
				<Item
					onSelect={function () {
						openProjectTasks(projectId);
					}}
				>
					<ListTodo className="size-4" />
					{projectName ? `Tarefas de ${projectName}` : "Ver tarefas do projeto"}
				</Item>
			)}
		</>
	);
}
