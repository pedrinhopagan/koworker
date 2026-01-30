import type { RouterOutputs } from "@/client";
import { useProjectFocus } from "@/hooks";

export type Project = RouterOutputs["projects"]["list"][number];

export function useProjectsData(preferredProjectId?: string | null) {
	const { projects, selectedProjectId, selectedProject, loading } = useProjectFocus({
		preferredProjectId: preferredProjectId ?? null,
	});

	return {
		data: {
			projects,
			total: projects.length,
			selectedProjectId,
			selectedProject,
		},
		loading,
	};
}
