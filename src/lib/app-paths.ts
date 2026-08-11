import { homedir } from "node:os";
import { join } from "node:path";

export const KOWORK_APP_IDENTIFIER = "com.pedro.kowork";

export function koworkerDataDir(): string {
	if (process.platform === "win32") {
		const base = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
		return join(base, KOWORK_APP_IDENTIFIER);
	}

	if (process.platform === "darwin") {
		return join(homedir(), "Library", "Application Support", KOWORK_APP_IDENTIFIER);
	}

	const base = process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share");

	return join(base, KOWORK_APP_IDENTIFIER);
}

export function koworkerDatabasePath(): string {
	return join(koworkerDataDir(), "kowork.db");
}
