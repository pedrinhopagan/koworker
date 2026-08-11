import { contextBridge, ipcRenderer } from "electron";

import { DESKTOP_CHANNELS } from "./channels";

contextBridge.exposeInMainWorld("kowork", {
	hideWindow: () => ipcRenderer.invoke(DESKTOP_CHANNELS.hideWindow),
	showWindow: () => ipcRenderer.invoke(DESKTOP_CHANNELS.showWindow),
	toggleWindow: () => ipcRenderer.invoke(DESKTOP_CHANNELS.toggleWindow),
	pickProjectFolder: (startIn?: string) =>
		ipcRenderer.invoke(DESKTOP_CHANNELS.pickProjectFolder, startIn),
	openDevtools: () => ipcRenderer.invoke(DESKTOP_CHANNELS.openDevtools),
	getVersion: () => ipcRenderer.invoke(DESKTOP_CHANNELS.getVersion),
});
