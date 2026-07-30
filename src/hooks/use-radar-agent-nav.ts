import { useNavigate } from "@tanstack/react-router";

import { useSelectedProjectStore } from "@/stores/selected-project";

export function useRadarAgentNav() {
	const navigate = useNavigate();
	const setSelectedProjectId = useSelectedProjectStore((s) => s.setSelectedProjectId);

	function openProjectTasks(projectId: string) {
		setSelectedProjectId(projectId);
		void navigate({ to: "/tarefas" });
	}

	function openTask(taskId: string, projectId?: string | null) {
		if (projectId) {
			setSelectedProjectId(projectId);
		}
		void navigate({ to: "/tarefas/$taskId", params: { taskId } });
	}

	return { openProjectTasks, openTask };
}
