import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { orpc } from "@/client";
import { useSelectedProjectStore } from "@/stores/selected-project";

type UseProjectFocusOptions = {
	preferredProjectId?: string | null;
	/**
	 * If true, keeps the selected-project store in sync with the resolved project.
	 * Set to false when the project is being driven by URL state.
	 */
	syncToStore?: boolean;
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
	const syncToStore = options.syncToStore ?? true;

	const selectedProjectId = useSelectedProjectStore((s) => s.selectedProjectId);
	const setSelectedProjectId = useSelectedProjectStore((s) => s.setSelectedProjectId);

	// O projeto que a tela realmente aponta: veio da URL ou de uma escolha do usuário. Nada de
	// palpite — quem dispara agente no diretório errado é o palpite, não a ausência de escolha.
	const explicitProjectId = useMemo(() => {
		if (
			preferredProjectId &&
			(projectsQuery.data === undefined ||
				projects.some((project) => project.id === preferredProjectId))
		) {
			return preferredProjectId;
		}

		if (selectedProjectId && projects.some((project) => project.id === selectedProjectId)) {
			return selectedProjectId;
		}

		return null;
	}, [preferredProjectId, projects, selectedProjectId, projectsQuery.data]);

	// Navegação, cor de tema e listagens continuam caindo no primeiro projeto quando não há escolha:
	// ali um palpite é conveniente e reversível.
	const resolvedProjectId = useMemo(() => {
		if (explicitProjectId) {
			return explicitProjectId;
		}

		if (selectedProjectId === undefined) {
			return;
		}

		return projects[0]?.id ?? null;
	}, [explicitProjectId, projects, selectedProjectId]);

	useEffect(() => {
		if (!syncToStore) return;
		if (projectsQuery.data === undefined) return;
		// Só a escolha explícita é persistida: gravar o fallback faria o palpite parecer escolha na
		// próxima leitura, e é isso que fazia o prompt sair no projeto errado.
		if (explicitProjectId && explicitProjectId !== selectedProjectId) {
			setSelectedProjectId(explicitProjectId);
		}
	}, [projectsQuery.data, explicitProjectId, selectedProjectId, setSelectedProjectId, syncToStore]);

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

	const explicitProject = useMemo(() => {
		if (!explicitProjectId) return null;
		return projects.find((project) => project.id === explicitProjectId) ?? null;
	}, [projects, explicitProjectId]);

	return {
		projects,
		selectedProjectId: resolvedProjectId,
		selectedProject,
		explicitProject,
		accent,
		loading: projectsQuery.isLoading,
		setSelectedProjectId,
	};
}

export type UseProjectFocusReturn = ReturnType<typeof useProjectFocus>;
