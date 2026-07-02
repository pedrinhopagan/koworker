import { homedir } from "node:os";
import { join } from "node:path";

// Identidade única do app no lado TS: CLI standalone e scripts de deploy. O Tauri declara a mesma
// identidade em src-tauri/tauri.conf.json — são runtimes diferentes (bundler nativo vs. binários
// Bun), então cada mundo carrega a sua cópia; aqui todos os consumidores TS leem de um só lugar.
export const KOWORK_APP_IDENTIFIER = "com.pedro.kowork";

// Espelha o app_local_data_dir() do Tauri por plataforma. A CLI é um binário Bun standalone (sem a
// API de paths do Tauri), então recalcula o mesmo diretório que backend.rs injeta em produção —
// senão a CLI e o app apontariam para bancos diferentes.
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
