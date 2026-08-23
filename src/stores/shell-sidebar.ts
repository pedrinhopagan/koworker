import { create } from "zustand";
import { persist } from "zustand/middleware";

type ShellSidebarMode = "compact" | "expanded";

interface ShellSidebarState {
	mode: ShellSidebarMode;
	toggleMode: () => void;
}

export const useShellSidebarStore = create<ShellSidebarState>()(
	persist(
		(set) => ({
			mode: "expanded",
			toggleMode: () =>
				set((state) => ({
					mode: state.mode === "compact" ? "expanded" : "compact",
				})),
		}),
		{ name: "kowork-shell-sidebar" },
	),
);
