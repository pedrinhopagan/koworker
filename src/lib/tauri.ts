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

// Imagem colada na webview do Tauri (WebKitGTK no Linux) não chega ao evento `paste` do DOM — o blob
// só existe no clipboard do OS. Lemos de lá os bytes RGBA crus e reencodamos em PNG pelo canvas, que é
// o formato que o `.koworker/medias/` guarda. Sem imagem no clipboard, `readImage` rejeita → null.
export async function readClipboardImageFile(): Promise<File | null> {
	if (!isTauri()) {
		return null;
	}

	const { readImage } = await import("@tauri-apps/plugin-clipboard-manager");
	const image = await readImage().catch(() => null);
	if (!image) {
		return null;
	}

	const { width, height } = await image.size();
	const rgba = await image.rgba();

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return null;
	}
	ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);

	const blob = await new Promise<Blob | null>((resolve) => {
		canvas.toBlob(resolve, "image/png");
	});
	return blob ? new File([blob], "clipboard.png", { type: "image/png" }) : null;
}

export async function pickProjectFolder(startIn?: string): Promise<string | null> {
	if (!isTauri()) {
		return null;
	}

	const args = startIn ? { start_in: startIn } : undefined;
	const result = await safeInvoke<string | null>("pick_project_folder", args);
	return result ?? null;
}
