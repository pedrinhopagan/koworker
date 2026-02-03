import { create } from "zustand";

export type TerminalEventType =
	| "session_opened"
	| "session_closed"
	| "window_opened"
	| "window_closed"
	| "route_opened"
	| "route_closed";

interface TerminalStatusState {
	activeSessions: Map<string, string>;
	activeWindows: Map<string, string>;

	setSessionActive: (projectId: string, sessionName: string) => void;
	setSessionClosed: (projectId: string) => void;
	setWindowActive: (taskId: string, windowName: string) => void;
	setWindowClosed: (taskId: string) => void;

	isProjectTerminalOpen: (projectId: string) => boolean;
	isTaskWindowOpen: (taskId: string) => boolean;

	handleEvent: (event: {
		eventType: TerminalEventType;
		projectId: string;
		taskId?: string;
		sessionName: string;
		windowName?: string;
	}) => void;
}

export const useTerminalStatusStore = create<TerminalStatusState>()((set, get) => ({
	activeSessions: new Map(),
	activeWindows: new Map(),

	setSessionActive: (projectId, sessionName) =>
		set((state) => ({
			activeSessions: new Map([...state.activeSessions, [projectId, sessionName]]),
		})),

	setSessionClosed: (projectId) =>
		set((state) => {
			const newSessions = new Map(state.activeSessions);
			newSessions.delete(projectId);

			const newWindows = new Map(state.activeWindows);
			for (const [taskId] of newWindows) {
				if (taskId.startsWith(`${projectId}:`)) {
					newWindows.delete(taskId);
				}
			}

			return { activeSessions: newSessions, activeWindows: newWindows };
		}),

	setWindowActive: (taskId, windowName) =>
		set((state) => ({
			activeWindows: new Map([...state.activeWindows, [taskId, windowName]]),
		})),

	setWindowClosed: (taskId) =>
		set((state) => {
			const newWindows = new Map(state.activeWindows);
			newWindows.delete(taskId);
			return { activeWindows: newWindows };
		}),

	isProjectTerminalOpen: (projectId) => get().activeSessions.has(projectId),

	isTaskWindowOpen: (taskId) => get().activeWindows.has(taskId),

	handleEvent: (event) => {
		const { eventType, projectId, taskId, sessionName, windowName } = event;
		const state = get();

		switch (eventType) {
			case "session_opened":
				state.setSessionActive(projectId, sessionName);
				break;
			case "session_closed":
				state.setSessionClosed(projectId);
				break;
			case "window_opened":
			case "route_opened":
				if (taskId && windowName) {
					state.setWindowActive(taskId, windowName);
				}
				break;
			case "window_closed":
			case "route_closed":
				if (taskId) {
					state.setWindowClosed(taskId);
				}
				break;
		}
	},
}));

export function useIsProjectTerminalOpen(projectId: string | undefined): boolean {
	return useTerminalStatusStore((state) =>
		projectId ? state.activeSessions.has(projectId) : false,
	);
}

export function useIsTaskWindowOpen(taskId: string): boolean {
	return useTerminalStatusStore((state) => state.activeWindows.has(taskId));
}
