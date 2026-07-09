import { homedir } from "node:os";
import { join } from "node:path";

import { TERMINAL_PRESETS, type TerminalMultiplexer } from "@/constants/terminal";
import { dbSettings } from "../db/settings";

// Configuração de SO resolvida para o shape interno. As linhas da tabela `settings` guardam strings;
// esta é a fronteira que as traduz e preenche os defaults por plataforma.
export type SystemSettings = {
	projectsBasePath: string;
	terminalTemplate: string;
	terminalMultiplexer: TerminalMultiplexer;
};

const SETTINGS_KEY = {
	projectsBasePath: "projects_base_path",
	terminalTemplate: "terminal_template",
	terminalMultiplexer: "terminal_multiplexer",
} as const;

// Defaults calculados por `process.platform`: kw-terminal (workspace persistente) no Linux/macOS,
// none no Windows (kw-terminal/tmux não existem lá). O `terminalTemplate` segue por preset, mas só é
// usado nos modos tmux/none — o kw-terminal é um TUI que o usuário roda no terminal que quiser. A
// pasta base é `~/Projects`.
export function defaultSystemSettings(): SystemSettings {
	const preset =
		process.platform === "win32"
			? "wt"
			: process.platform === "darwin"
				? "macos-terminal"
				: "alacritty";

	return {
		projectsBasePath: join(homedir(), "Projects"),
		terminalTemplate: TERMINAL_PRESETS[preset].template,
		terminalMultiplexer: process.platform === "win32" ? "none" : "kw-terminal",
	};
}

export async function getSystemSettings(): Promise<SystemSettings> {
	const stored = new Map((await dbSettings.getAll()).map((row) => [row.key, row.value]));
	const defaults = defaultSystemSettings();
	const multiplexer = stored.get(SETTINGS_KEY.terminalMultiplexer);

	return {
		projectsBasePath: stored.get(SETTINGS_KEY.projectsBasePath) ?? defaults.projectsBasePath,
		terminalTemplate: stored.get(SETTINGS_KEY.terminalTemplate) ?? defaults.terminalTemplate,
		terminalMultiplexer:
			multiplexer === "tmux" || multiplexer === "none" || multiplexer === "kw-terminal"
				? multiplexer
				: defaults.terminalMultiplexer,
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
	if (input.terminalTemplate !== undefined) {
		writes.push(
			dbSettings.set({ key: SETTINGS_KEY.terminalTemplate, value: input.terminalTemplate }),
		);
	}
	if (input.terminalMultiplexer !== undefined) {
		writes.push(
			dbSettings.set({ key: SETTINGS_KEY.terminalMultiplexer, value: input.terminalMultiplexer }),
		);
	}

	await Promise.all(writes);
}
