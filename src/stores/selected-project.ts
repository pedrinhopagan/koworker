import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SelectedProjectState {
	/**
	 * - string: project selecionado
	 * - null: estado inicial (auto-resolve pro 1º projeto quando disponível)
	 * - undefined: "Todos os projetos" (não filtra)
	 */
	selectedProjectId: string | null | undefined;
	setSelectedProjectId: (id: string | null | undefined) => void;
}

export const useSelectedProjectStore = create<SelectedProjectState>()(
	persist(
		(set) => ({
			selectedProjectId: null,
			setSelectedProjectId: (id) => set({ selectedProjectId: id }),
		}),
		{
			name: "kowork-selected-project",
		},
	),
);
