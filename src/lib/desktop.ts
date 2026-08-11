export type KoworkDesktopBridge = {
	hideWindow: () => Promise<void>;
	showWindow: () => Promise<void>;
	toggleWindow: () => Promise<void>;
	pickProjectFolder: (startIn?: string) => Promise<string | null>;
	openDevtools: () => Promise<boolean>;
	getVersion: () => Promise<string>;
};

declare global {
	interface Window {
		kowork?: KoworkDesktopBridge;
	}
}

export function isDesktop(): boolean {
	return typeof window !== "undefined" && !!window.kowork;
}

export function hideWindow(): void {
	void window.kowork?.hideWindow();
}

export async function showWindow(): Promise<void> {
	await window.kowork?.showWindow();
}

export async function openDevtools(): Promise<boolean> {
	return (await window.kowork?.openDevtools()) ?? false;
}

export async function getDesktopVersion(): Promise<string | null> {
	return (await window.kowork?.getVersion()) ?? null;
}

export async function pickProjectFolder(startIn?: string): Promise<string | null> {
	return (await window.kowork?.pickProjectFolder(startIn)) ?? null;
}
