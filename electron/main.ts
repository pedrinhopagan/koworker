import { mkdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell, Tray } from "electron";

import { BackendProcess } from "./backend";
import { DESKTOP_CHANNELS } from "./channels";

type WindowCommand = "hide" | "quit" | "show" | "toggle";

const isDevelopment = !app.isPackaged;
const appName = isDevelopment ? "kowork-dev" : "kowork";
const appTitle = isDevelopment ? "Kowork Dev" : "Kowork";
const backend = new BackendProcess();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let stoppingBackend = false;
let backendStopped = false;

app.setName(appName);
if (process.platform === "linux") {
	app.commandLine.appendSwitch("class", appName);
	app.commandLine.appendSwitch("ozone-platform", "x11");
}

function commandFromArgv(argv: string[], fallback: WindowCommand | null): WindowCommand | null {
	if (argv.includes("--quit") || argv.includes("quit")) {
		return "quit";
	}

	if (argv.includes("--hide") || argv.includes("hide")) {
		return "hide";
	}

	if (argv.includes("--toggle") || argv.includes("toggle")) {
		return "toggle";
	}

	return argv.includes("--show") || argv.includes("show") ? "show" : fallback;
}

function commandFromSwitches(): WindowCommand | null {
	for (const command of ["quit", "hide", "toggle", "show"] as const) {
		if (app.commandLine.hasSwitch(command)) {
			return command;
		}
	}

	return null;
}

function showWindow() {
	if (!mainWindow) {
		return;
	}

	if (mainWindow.isMinimized()) {
		mainWindow.restore();
	}

	mainWindow.show();
	mainWindow.focus();
}

function hideWindow() {
	mainWindow?.hide();
}

function toggleWindow() {
	if (!mainWindow) {
		return;
	}

	if (mainWindow.isVisible() && !mainWindow.isMinimized() && mainWindow.isFocused()) {
		hideWindow();

		return;
	}

	showWindow();
}

function applyWindowCommand(command: WindowCommand) {
	if (command === "quit") {
		quitting = true;
		app.quit();

		return;
	}

	if (command === "hide") {
		hideWindow();

		return;
	}

	if (command === "toggle") {
		toggleWindow();

		return;
	}

	showWindow();
}

function registerIpc() {
	ipcMain.handle(DESKTOP_CHANNELS.hideWindow, hideWindow);
	ipcMain.handle(DESKTOP_CHANNELS.showWindow, showWindow);
	ipcMain.handle(DESKTOP_CHANNELS.toggleWindow, toggleWindow);
	ipcMain.handle(DESKTOP_CHANNELS.pickProjectFolder, async (_event, startIn?: string) => {
		const options = {
			properties: ["openDirectory"],
			...(startIn ? { defaultPath: startIn } : {}),
		} satisfies Electron.OpenDialogOptions;
		const result = mainWindow
			? await dialog.showOpenDialog(mainWindow, options)
			: await dialog.showOpenDialog(options);

		return result.canceled ? null : (result.filePaths[0] ?? null);
	});
	ipcMain.handle(DESKTOP_CHANNELS.openDevtools, () => {
		if (!mainWindow) {
			return false;
		}

		mainWindow.webContents.openDevTools({ mode: "detach" });

		return true;
	});
	ipcMain.handle(DESKTOP_CHANNELS.getVersion, () => app.getVersion());
}

function createTray() {
	const shortcut = isDevelopment ? "Alt+L" : "Alt+K";
	tray = new Tray(
		join(app.getAppPath(), "electron", "icons", isDevelopment ? "dev/32x32.png" : "32x32.png"),
	);
	tray.setToolTip(`Kowork - ${shortcut} para abrir`);
	tray.setContextMenu(
		Menu.buildFromTemplate([
			{ label: "Abrir Kowork", click: showWindow },
			{
				label: "Sair",
				click: () => {
					quitting = true;
					app.quit();
				},
			},
		]),
	);
	tray.on("click", toggleWindow);
}

function desktopEntryArgument(value: string) {
	return `"${value
		.replaceAll("\\", "\\\\")
		.replaceAll('"', '\\"')
		.replaceAll("`", "\\`")
		.replaceAll("$", "\\$")
		.replaceAll("%", "%%")}"`;
}

async function enableAutostart() {
	if (isDevelopment) {
		return;
	}

	if (process.platform !== "linux") {
		app.setLoginItemSettings(
			process.platform === "win32"
				? { openAtLogin: true, args: ["--hide"] }
				: { openAtLogin: true },
		);

		return;
	}

	const configDir = process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
	const autostartDir = join(configDir, "autostart");
	const target = join(autostartDir, "kowork.desktop");
	const staging = `${target}.staging`;
	const executable = process.env.APPIMAGE ?? app.getPath("exe");
	const desktopEntry = [
		"[Desktop Entry]",
		"Type=Application",
		"Name=Kowork",
		`Exec=${desktopEntryArgument(executable)} --hide`,
		"Terminal=false",
		"X-GNOME-Autostart-enabled=true",
		"",
	].join("\n");

	await mkdir(autostartDir, { recursive: true });
	await writeFile(staging, desktopEntry);
	await rename(staging, target);
}

async function createWindow() {
	const apiOrigin = `http://localhost:${backend.port}`;
	const icon = join(
		app.getAppPath(),
		"electron",
		"icons",
		isDevelopment ? "dev/128x128.png" : "128x128.png",
	);

	mainWindow = new BrowserWindow({
		title: appTitle,
		width: 1080,
		height: 750,
		minWidth: 512,
		minHeight: 500,
		center: true,
		frame: false,
		show: false,
		icon,
		webPreferences: {
			preload: join(app.getAppPath(), "electron", "out", "preload.cjs"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
		},
	});

	mainWindow.on("close", (event) => {
		if (!quitting) {
			event.preventDefault();
			hideWindow();
		}
	});
	mainWindow.on("closed", () => {
		mainWindow = null;
	});
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith("http://") || url.startsWith("https://")) {
			void shell.openExternal(url);
		}

		return { action: "deny" };
	});
	mainWindow.webContents.on("will-navigate", (event, url) => {
		if (new URL(url).origin !== apiOrigin) {
			event.preventDefault();
		}
	});

	await backend.start();
	await mainWindow.loadURL(apiOrigin);
}

const firstCommand = commandFromArgv(process.argv, null) ?? commandFromSwitches();
const gotLock = app.requestSingleInstanceLock({ command: firstCommand });

async function runPrimaryInstance() {
	app.on("second-instance", (_event, argv, _workingDirectory, additionalData) => {
		const command =
			typeof additionalData === "object" &&
			additionalData !== null &&
			"command" in additionalData &&
			typeof additionalData.command === "string"
				? commandFromArgv([additionalData.command], "show")
				: commandFromArgv(argv, "show");

		console.log(`[KOWORK] Comando da segunda instância: ${command ?? "show"}`);
		applyWindowCommand(command ?? "show");
	});

	app.on("activate", showWindow);
	app.on("before-quit", () => {
		quitting = true;
	});
	app.on("will-quit", (event) => {
		if (backendStopped) {
			return;
		}

		event.preventDefault();
		if (stoppingBackend) {
			return;
		}

		stoppingBackend = true;
		void backend.stop().finally(() => {
			backendStopped = true;
			app.exit(0);
		});
	});

	try {
		await app.whenReady();
		const apiOrigin = `http://localhost:${backend.port}`;
		session.defaultSession.setPermissionCheckHandler(
			(_webContents, permission, requestingOrigin) =>
				permission === "media" && requestingOrigin.startsWith(apiOrigin),
		);
		session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) =>
			callback(permission === "media" && webContents.getURL().startsWith(apiOrigin)),
		);
		registerIpc();
		await createWindow();
		createTray();
		await enableAutostart().catch((error) => {
			console.error("[KOWORK] Falha ao configurar inicialização automática", error);
		});

		if (firstCommand === "show" || firstCommand === "toggle") {
			showWindow();
		}
	} catch (error) {
		dialog.showErrorBox(
			"Kowork não iniciou",
			error instanceof Error ? error.message : String(error),
		);
		quitting = true;
		app.quit();
	}
}

if (gotLock) {
	void runPrimaryInstance();
} else {
	app.quit();
}
