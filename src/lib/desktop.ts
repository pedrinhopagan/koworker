export type KoworkDesktopBridge = {
	hideWindow: () => Promise<void>;
	showWindow: () => Promise<void>;
	toggleWindow: () => Promise<void>;
	minimizeWindow: () => Promise<void>;
	toggleMaximize: () => Promise<boolean>;
	isMaximized: () => Promise<boolean>;
	onMaximizedChange: (listener: (maximized: boolean) => void) => () => void;
	pickProjectFolder: (startIn?: string) => Promise<string | null>;
	copyFile: (path: string) => Promise<void>;
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

export function minimizeWindow(): void {
	void window.kowork?.minimizeWindow();
}

export async function toggleMaximize(): Promise<boolean> {
	return (await window.kowork?.toggleMaximize()) ?? false;
}

export async function isWindowMaximized(): Promise<boolean> {
	return (await window.kowork?.isMaximized()) ?? false;
}

export function onWindowMaximizedChange(listener: (maximized: boolean) => void): () => void {
	return window.kowork?.onMaximizedChange(listener) ?? (() => {});
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

export async function copyFileToClipboard(path: string): Promise<void> {
	if (!window.kowork?.copyFile) {
		throw new Error("Copiar arquivos está disponível no app para computador");
	}

	await window.kowork.copyFile(path);
}
