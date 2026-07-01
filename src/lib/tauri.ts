/**
 * Tauri API Wrappers
 * Provides safe access to Tauri APIs with fallbacks for browser environment
 */

declare global {
	interface Window {
		__TAURI_INTERNALS__?: unknown;
	}
}

export function isTauri(): boolean {
	return typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
}

export async function safeInvoke<T>(
	command: string,
	args?: Record<string, unknown>,
): Promise<T | null> {
	if (!isTauri()) {
		console.warn(`[Tauri] Command "${command}" ignored: not in Tauri environment`);
		return null;
	}
	try {
		const { invoke } = await import("@tauri-apps/api/core");
		// Importante: `invoke()` retorna Promise; precisamos `await` aqui para capturar rejeições.
		return await invoke<T>(command, args);
	} catch (error) {
		console.error(`[Tauri] Failed to invoke "${command}":`, error);
		return null;
	}
}

export async function safeListen<T>(
	event: string,
	handler: (event: { payload: T }) => void,
): Promise<() => void> {
	if (!isTauri()) {
		return () => {};
	}
	try {
		const { listen } = await import("@tauri-apps/api/event");
		return listen<T>(event, handler);
	} catch (error) {
		console.error(`[Tauri] Failed to listen to "${event}":`, error);
		return () => {};
	}
}

export async function safeGetCurrentWindow() {
	if (!isTauri()) {
		return null;
	}
	try {
		const { getCurrentWindow } = await import("@tauri-apps/api/window");
		return getCurrentWindow();
	} catch (error) {
		console.error("[Tauri] Failed to get current window:", error);
		return null;
	}
}

// Convenience functions for window management
export function hideWindow(): void {
	safeInvoke("hide_window");
}

export async function openDevtools(): Promise<boolean> {
	if (!isTauri()) {
		return false;
	}

	const result = await safeInvoke<boolean>("open_devtools");
	return result ?? false;
}

export async function startWindowDrag(e: React.MouseEvent): Promise<void> {
	// Only drag if left-clicking on nav area (not on links/buttons)
	if (
		e.button === 0 &&
		(e.target as HTMLElement).closest("nav") &&
		!(e.target as HTMLElement).closest("a") &&
		!(e.target as HTMLElement).closest("button")
	) {
		const win = await safeGetCurrentWindow();
		win?.startDragging();
	}
}

export async function pickProjectFolder(startIn?: string): Promise<string | null> {
	if (!isTauri()) {
		return null;
	}

	const args = startIn ? { start_in: startIn } : undefined;
	const result = await safeInvoke<string | null>("pick_project_folder", args);
	return result ?? null;
}

export type OpenTerminalResult = {
	sessionName: string;
	windowName: string;
	isNewSession: boolean;
	isNewWindow: boolean;
};

export type OpenTerminalParams = {
	projectId: string;
	projectName: string;
	mainRoute: string;
	taskId: string;
	taskTitle: string;
	prompt?: string;
	agent?: string;
	model?: string;
	effort?: string;
	permissionMode?: string;
	forceNew?: boolean;
	background?: boolean;
};

export function openTerminalForTask(
	params: OpenTerminalParams,
): Promise<OpenTerminalResult | null> {
	if (!isTauri()) {
		console.warn("[Terminal] Não está em ambiente Tauri");
		return Promise.resolve(null);
	}

	return safeInvoke<OpenTerminalResult>("open_terminal_for_task", params);
}

export async function closeProjectSession(
	projectId: string,
	projectName: string,
): Promise<boolean> {
	if (!isTauri()) {
		return false;
	}

	const result = await safeInvoke<null>("close_project_session", {
		projectId,
		projectName,
	});
	return result !== null;
}

export async function closeTaskWindow(
	projectId: string,
	projectName: string,
	taskId: string,
	taskTitle: string,
): Promise<boolean> {
	if (!isTauri()) {
		return false;
	}

	const result = await safeInvoke<null>("close_task_window", {
		projectId,
		projectName,
		taskId,
		taskTitle,
	});
	return result !== null;
}

export type ProjectRef = {
	id: string;
	name: string;
};

export type InvocationSessionInfo = {
	projectId: string;
	projectName: string;
	sessionName: string;
	windowCount: number;
};

export async function listInvocationSessions(
	projects: ProjectRef[],
): Promise<InvocationSessionInfo[]> {
	if (!isTauri()) {
		return [];
	}

	const result = await safeInvoke<InvocationSessionInfo[]>("list_invocation_sessions", {
		projects,
	});
	return result ?? [];
}

export async function closeInvocationSessions(projects: ProjectRef[]): Promise<number> {
	if (!isTauri()) {
		return 0;
	}

	const result = await safeInvoke<number>("close_invocation_sessions", { projects });
	return result ?? 0;
}

export type SessionInfo = {
	projectId: string;
	sessionName: string;
	windows: Array<{
		taskId: string;
		windowName: string;
	}>;
};

export async function getActiveSessions(): Promise<SessionInfo[]> {
	if (!isTauri()) {
		return [];
	}

	const result = await safeInvoke<SessionInfo[]>("get_active_sessions");
	return result ?? [];
}

export async function checkSessionExists(projectName: string): Promise<boolean> {
	if (!isTauri()) {
		return false;
	}

	const result = await safeInvoke<boolean>("check_session_exists", {
		projectName,
	});
	return result ?? false;
}
