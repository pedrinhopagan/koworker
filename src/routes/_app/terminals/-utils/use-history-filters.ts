import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

import type { HistoryCli } from "@/api/schemas/agent-history";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { ALL_PROJECTS, type HistorySearchParams } from "./history-search";
import type { HistoryFiltersValue } from "../-components/history-filters";

// O recorte da tela, resolvido a partir da URL e do projeto em destaque. Quem escolhe "todos" grava
// isso na URL; quem não escolheu nada segue o destaque do app e muda junto com ele.
export function useHistoryFilters(search: HistorySearchParams) {
	const navigate = useNavigate();
	const { projects, selectedProjectId, loading } = useProjectFocus();

	const filters = useMemo<HistoryFiltersValue>(
		() => ({
			projectId:
				search.projectId === ALL_PROJECTS ? null : (search.projectId ?? selectedProjectId ?? null),
			cli: (search.cli as HistoryCli | undefined) ?? null,
			search: search.q ?? "",
		}),
		[search.projectId, search.cli, search.q, selectedProjectId],
	);

	const update = useCallback(
		(next: Partial<HistoryFiltersValue>) => {
			void navigate({
				to: ".",
				search: (previous: HistorySearchParams) => ({
					...previous,
					...("projectId" in next ? { projectId: next.projectId ?? ALL_PROJECTS } : {}),
					...("cli" in next ? { cli: next.cli ?? undefined } : {}),
					...("search" in next ? { q: next.search?.trim() ? next.search : undefined } : {}),
				}),
				replace: true,
			});
		},
		[navigate],
	);

	// O que os links carregam adiante: o mesmo recorte, já sem o que é padrão.
	const linkSearch = useMemo(
		() => ({
			...(search.projectId ? { projectId: search.projectId } : {}),
			...(search.cli ? { cli: search.cli } : {}),
			...(search.q ? { q: search.q } : {}),
		}),
		[search.projectId, search.cli, search.q],
	);

	return { filters, update, linkSearch, projects, projectsLoading: loading };
}
