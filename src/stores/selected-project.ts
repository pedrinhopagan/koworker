import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SelectedProjectState {
	selectedProjectId: string | null;
	setSelectedProjectId: (id: string | null) => void;
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
