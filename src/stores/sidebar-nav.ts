import { create } from "zustand";
import { persist } from "zustand/middleware";

type SidebarNavMode = "compact" | "expanded";

interface SidebarNavState {
	mode: SidebarNavMode;
	toggleMode: () => void;
	setMode: (mode: SidebarNavMode) => void;
}

export const useSidebarNavStore = create<SidebarNavState>()(
	persist(
		(set) => ({
			mode: "expanded",
			toggleMode: () =>
				set((state) => ({
					mode: state.mode === "compact" ? "expanded" : "compact",
				})),
			setMode: (mode) => set({ mode }),
		}),
		{ name: "kowork-sidebar-nav" },
	),
);
