import { create } from "zustand";
import { persist } from "zustand/middleware";

type AgentSidebarMode = "compact" | "expanded";

interface AgentSidebarState {
	mode: AgentSidebarMode;
	toggleMode: () => void;
}

export const useAgentSidebarStore = create<AgentSidebarState>()(
	persist(
		(set) => ({
			mode: "expanded",
			toggleMode: () =>
				set((state) => ({
					mode: state.mode === "compact" ? "expanded" : "compact",
				})),
		}),
		{ name: "kowork-agent-sidebar" },
	),
);
