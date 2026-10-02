import { create } from "zustand";
import { persist } from "zustand/middleware";

export const SPLIT_PANE_DEFAULT = 520;
export const SPLIT_PANE_MIN = 320;
export const SPLIT_MAIN_MIN = 420;
export const SHELL_PANE_WIDTH_PROPERTY = "--shell-pane-width";

export function shellPaneWidthValue(): string {
	return `var(${SHELL_PANE_WIDTH_PROPERTY}, ${SPLIT_PANE_DEFAULT}px)`;
}

export function rootOf(path: string): string {
	return path.split("?")[0] ?? "/";
}

export function isShellsPath(path: string): boolean {
	const clean = rootOf(path);
	return clean === "/shells" || clean.startsWith("/shells/");
}

export function clampSplitPaneWidth(width: number, available: number): number {
	const max = Math.max(SPLIT_PANE_MIN, Math.round(available) - SPLIT_MAIN_MIN);
	return Math.min(Math.max(Math.round(width), SPLIT_PANE_MIN), max);
}

function normalizePinnedPath(path?: string): string {
	return path && path.startsWith("/") ? path : "/shells";
}

interface SplitViewState {
	path: string | null;
	width: number;
	resizing: boolean;
	pulse: number;
	open: (path?: string) => void;
	close: () => void;
	toggle: (path?: string) => void;
	poke: () => void;
	setWidth: (width: number) => void;
	setResizing: (resizing: boolean) => void;
}

export const useSplitViewStore = create<SplitViewState>()(
	persist(
		(set) => ({
			path: null,
			width: SPLIT_PANE_DEFAULT,
			resizing: false,
			pulse: 0,
			open: (path) => set({ path: normalizePinnedPath(path), resizing: false }),
			close: () => set({ path: null, resizing: false }),
			toggle: (path) =>
				set((state) =>
					state.path
						? { path: null, resizing: false }
						: { path: normalizePinnedPath(path), resizing: false },
				),
			poke: () => set((state) => ({ pulse: state.pulse + 1 })),
			setWidth: (width) => set({ width }),
			setResizing: (resizing) => set({ resizing }),
		}),
		{
			name: "kowork-split-view",
			partialize: (state) => ({ path: state.path, width: state.width }),
		},
	),
);
