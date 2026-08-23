import { create } from "zustand";
import { persist } from "zustand/middleware";

export const SPLIT_PANE_MIN = 320;
export const SPLIT_PANE_MAX_RATIO = 0.75;

function clampWidth(width: number): number {
	const max = Math.max(SPLIT_PANE_MIN, Math.round(window.innerWidth * SPLIT_PANE_MAX_RATIO));
	return Math.min(Math.max(width, SPLIT_PANE_MIN), max);
}

interface SplitViewState {
	left: string | null;
	width: number;
	pin: (path: string) => void;
	unpin: () => void;
	toggle: (path: string) => void;
	setWidth: (width: number) => void;
}

export function maxSplitPaneWidth(): number {
	return Math.max(SPLIT_PANE_MIN, Math.round(window.innerWidth * SPLIT_PANE_MAX_RATIO));
}

export const useSplitViewStore = create<SplitViewState>()(
	persist(
		(set) => ({
			left: null,
			width: 520,
			pin: (path) => set({ left: path }),
			unpin: () => set({ left: null }),
			toggle: (path) => set((state) => ({ left: state.left === path ? null : path })),
			setWidth: (width) =>
				set(typeof window === "undefined" ? { width } : { width: clampWidth(width) }),
		}),
		{
			name: "kowork-split-view",
			partialize: (state) => ({ left: state.left, width: state.width }),
		},
	),
);

export function isSessionPath(path: string): boolean {
	return path === "/shells" || path.startsWith("/shells/") || path.startsWith("/terminals/");
}
