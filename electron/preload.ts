import { contextBridge, ipcRenderer } from "electron";

import { DESKTOP_CHANNELS } from "./channels";

contextBridge.exposeInMainWorld("kowork", {
	hideWindow: () => ipcRenderer.invoke(DESKTOP_CHANNELS.hideWindow),
	showWindow: () => ipcRenderer.invoke(DESKTOP_CHANNELS.showWindow),
	toggleWindow: () => ipcRenderer.invoke(DESKTOP_CHANNELS.toggleWindow),
	minimizeWindow: () => ipcRenderer.invoke(DESKTOP_CHANNELS.minimizeWindow),
	toggleMaximize: () => ipcRenderer.invoke(DESKTOP_CHANNELS.toggleMaximize),
	isMaximized: () => ipcRenderer.invoke(DESKTOP_CHANNELS.isMaximized),
	onMaximizedChange: (listener: (maximized: boolean) => void) => {
		const handler = (_event: unknown, maximized: boolean) => listener(maximized);
		ipcRenderer.on(DESKTOP_CHANNELS.maximizedChanged, handler);
		return () => ipcRenderer.removeListener(DESKTOP_CHANNELS.maximizedChanged, handler);
	},
	pickProjectFolder: (startIn?: string) =>
		ipcRenderer.invoke(DESKTOP_CHANNELS.pickProjectFolder, startIn),
	openDevtools: () => ipcRenderer.invoke(DESKTOP_CHANNELS.openDevtools),
	getVersion: () => ipcRenderer.invoke(DESKTOP_CHANNELS.getVersion),
});
