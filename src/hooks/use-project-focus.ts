import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/client";
import { useSelectedProjectStore } from "@/stores/selected-project";

type UseProjectFocusOptions = {
	preferredProjectId?: string | null;
};

const withAlpha = (color: string, alpha: string) => {
	if (color.startsWith("#") && color.length === 7) {
		return `${color}${alpha}`;
	}
	return color;
};

export function useProjectFocus(options: UseProjectFocusOptions = {}) {
	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const projects = projectsQuery.data ?? [];
	const preferredProjectId = options.preferredProjectId ?? null;

	const selectedProjectId = useSelectedProjectStore((s) => s.selectedProjectId);
	const setSelectedProjectId = useSelectedProjectStore((s) => s.setSelectedProjectId);

	const resolvedProjectId = useMemo(() => {
		if (preferredProjectId && projects.some((project) => project.id === preferredProjectId)) {
			return preferredProjectId;
		}
		if (selectedProjectId && projects.some((project) => project.id === selectedProjectId)) {
			return selectedProjectId;
		}
		return projects[0]?.id ?? null;
	}, [preferredProjectId, projects, selectedProjectId]);

	useEffect(() => {
		if (resolvedProjectId !== selectedProjectId) {
			setSelectedProjectId(resolvedProjectId);
		}
	}, [resolvedProjectId, selectedProjectId, setSelectedProjectId]);

	const selectedProject = useMemo(() => {
		if (!resolvedProjectId) return null;
		return projects.find((project) => project.id === resolvedProjectId) ?? null;
	}, [projects, resolvedProjectId]);

	const accent = useMemo(() => {
		const color = selectedProject?.color ?? null;
		if (!color) return null;
		return {
			color,
			soft: withAlpha(color, "14"),
			muted: withAlpha(color, "0d"),
			border: withAlpha(color, "55"),
			glow: withAlpha(color, "40"),
			ring: withAlpha(color, "33"),
		};
	}, [selectedProject?.color]);

	return {
		projects,
		selectedProjectId: resolvedProjectId,
		selectedProject,
		accent,
		loading: projectsQuery.isLoading,
		setSelectedProjectId,
	};
}
