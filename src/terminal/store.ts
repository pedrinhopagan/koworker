import { create } from "zustand";

export type TerminalSession = {
	taskId: string;
	sessionId: string;
	tmuxSession: string;
};

export type TerminalSlot = {
	top: number;
	left: number;
	width: number;
	height: number;
	visible: boolean;
};

type TerminalStore = {
	sessionsByTask: Record<string, TerminalSession>;
	slotsByTask: Record<string, TerminalSlot>;
	setSession: (taskId: string, sessionId: string, tmuxSession: string) => void;
	clearSession: (taskId: string) => void;
	setSlot: (taskId: string, slot: TerminalSlot) => void;
	clearSlot: (taskId: string) => void;
};

export const useTerminalStore = create<TerminalStore>((set) => ({
	sessionsByTask: {},
	slotsByTask: {},
	setSession: (taskId, sessionId, tmuxSession) =>
		set((state) => ({
			sessionsByTask: {
				...state.sessionsByTask,
				[taskId]: { taskId, sessionId, tmuxSession },
			},
		})),
	clearSession: (taskId) =>
		set((state) => {
			const { [taskId]: _removed, ...rest } = state.sessionsByTask;
			return { sessionsByTask: rest };
		}),
	setSlot: (taskId, slot) =>
		set((state) => ({
			slotsByTask: {
				...state.slotsByTask,
				[taskId]: slot,
			},
		})),
	clearSlot: (taskId) =>
		set((state) => {
			const { [taskId]: _removed, ...rest } = state.slotsByTask;
			return { slotsByTask: rest };
		}),
}));
