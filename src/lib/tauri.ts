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
		return invoke<T>(command, args);
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
