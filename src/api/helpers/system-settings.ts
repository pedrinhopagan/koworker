import { homedir } from "node:os";
import { join } from "node:path";

import { dbSettings } from "../db/settings";

// Configuração de SO resolvida para o shape interno. As linhas da tabela `settings` guardam strings;
// esta é a fronteira que as traduz e preenche os defaults.
export type SystemSettings = {
	projectsBasePath: string;
	// Endereço por onde o celular alcança este backend (o host HTTPS do `tailscale serve`). É o que o
	// QR de pareamento carrega: o backend não tem como adivinhar o nome desta máquina na tailnet.
	mobileBaseUrl: string;
};

const SETTINGS_KEY = {
	projectsBasePath: "projects_base_path",
	mobileBaseUrl: "mobile_base_url",
} as const;

// Chaves do tempo em que o terminal externo tinha multiplexador e emulador configuráveis. Hoje o
// terminal externo é sempre o kw-terminal.
export const LEGACY_TERMINAL_SETTING_KEYS = ["terminal_multiplexer", "terminal_template"];

export function defaultSystemSettings(): SystemSettings {
	return {
		projectsBasePath: join(homedir(), "Projects"),
		mobileBaseUrl: "",
	};
}

export async function getSystemSettings(): Promise<SystemSettings> {
	const stored = new Map((await dbSettings.getAll()).map((row) => [row.key, row.value]));
	const defaults = defaultSystemSettings();

	return {
		projectsBasePath: stored.get(SETTINGS_KEY.projectsBasePath) ?? defaults.projectsBasePath,
		mobileBaseUrl: stored.get(SETTINGS_KEY.mobileBaseUrl) ?? defaults.mobileBaseUrl,
	};
}

// Escrita parcial (PATCH): grava só as chaves presentes. Os writes são independentes, então correm
// juntos.
export async function setSystemSettings(input: Partial<SystemSettings>): Promise<void> {
	const writes = [];

	if (input.projectsBasePath !== undefined) {
		writes.push(
			dbSettings.set({ key: SETTINGS_KEY.projectsBasePath, value: input.projectsBasePath }),
		);
	}
	if (input.mobileBaseUrl !== undefined) {
		writes.push(dbSettings.set({ key: SETTINGS_KEY.mobileBaseUrl, value: input.mobileBaseUrl }));
	}

	await Promise.all(writes);
}
