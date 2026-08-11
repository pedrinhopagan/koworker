import { dbAgentSessionSnapshots } from "../../db/agent-session-snapshots";
import { getSystemSettings } from "../system-settings";
import {
	ensureKwTerminalServer,
	ensureWorkspaceByLabel,
	findTabByLabel,
	kwTerminalTabCreate,
	type KwTerminalWorkspace,
} from "../terminal/kw-terminal";
import { revealKwTerminalClient } from "../terminal/service";

export type SavedTerminalSource = {
	id: string;
	workspace_label: string;
	tab_label: string;
	cwd: string;
};

export type SavedTerminal = {
	key: string;
	ids: string[];
	workspaceLabel: string;
	tabLabel: string;
	cwd: string;
};

let reopening = false;
const PROCESS_STARTED_AT = Date.now();

export function groupSavedTerminals(rows: SavedTerminalSource[]): SavedTerminal[] {
	const terminals = new Map<string, SavedTerminal>();

	for (const row of rows) {
		const key = `${row.workspace_label}\0${row.tab_label}`;
		const terminal = terminals.get(key);

		if (terminal) {
			terminal.ids.push(row.id);
			continue;
		}

		terminals.set(key, {
			key,
			ids: [row.id],
			workspaceLabel: row.workspace_label,
			tabLabel: row.tab_label,
			cwd: row.cwd,
		});
	}

	return [...terminals.values()];
}

// O retrato guarda o label do grupo como ele estava, então a reabertura o recria verbatim — inclusive
// grupos que o próprio kw-terminal nomeou. Confere a criação porque o retrato é a única fonte aqui.
async function ensureWorkspace(terminal: SavedTerminal) {
	const { workspace, isNew } = await ensureWorkspaceByLabel({
		label: terminal.workspaceLabel,
		cwd: terminal.cwd,
	});

	if (isNew && !workspace.workspace_id) {
		throw new Error(`O workspace ${terminal.workspaceLabel} não foi criado`);
	}

	return workspace;
}

async function ensureTab(terminal: SavedTerminal, workspace: KwTerminalWorkspace) {
	if (await findTabByLabel(workspace.workspace_id, terminal.tabLabel)) {
		return false;
	}

	await kwTerminalTabCreate({
		workspaceId: workspace.workspace_id,
		cwd: terminal.cwd,
		label: terminal.tabLabel,
		focus: false,
	});

	if (!(await findTabByLabel(workspace.workspace_id, terminal.tabLabel))) {
		throw new Error(`A tab ${terminal.tabLabel} não foi criada`);
	}

	return true;
}

export async function getSavedTerminals() {
	const rows = await dbAgentSessionSnapshots.listPendingBefore(PROCESS_STARTED_AT);
	const terminals = groupSavedTerminals(rows);

	return {
		capturedAt: rows[0]?.captured_at ?? null,
		count: terminals.length,
	};
}

export async function reopenSavedTerminals() {
	if (reopening) {
		throw new Error("Os terminais já estão sendo reabertos");
	}

	reopening = true;

	try {
		const rows = await dbAgentSessionSnapshots.listPendingBefore(PROCESS_STARTED_AT);
		const terminals = groupSavedTerminals(rows);
		if (terminals.length === 0) {
			throw new Error("Não há terminais guardados para reabrir");
		}

		await ensureKwTerminalServer();

		const workspaces = new Map<string, KwTerminalWorkspace>();
		const restoredIds: string[] = [];
		let opened = 0;
		let existing = 0;
		let failed = 0;
		let workingDir: string | null = null;

		for (const terminal of terminals) {
			try {
				const workspace =
					workspaces.get(terminal.workspaceLabel) ?? (await ensureWorkspace(terminal));
				workspaces.set(terminal.workspaceLabel, workspace);

				if (await ensureTab(terminal, workspace)) {
					opened += 1;
				} else {
					existing += 1;
				}

				restoredIds.push(...terminal.ids);
				workingDir ??= terminal.cwd;
			} catch (error) {
				failed += 1;
				console.error(
					`[Radar] Falha ao reabrir ${terminal.workspaceLabel}/${terminal.tabLabel}:`,
					error,
				);
			}
		}

		if (restoredIds.length === 0 || !workingDir) {
			throw new Error("Nenhum terminal guardado pôde ser reaberto");
		}

		await dbAgentSessionSnapshots.markRestored(restoredIds);

		const settings = await getSystemSettings();
		await revealKwTerminalClient({
			config: {
				template: settings.terminalTemplate,
				multiplexer: settings.terminalMultiplexer,
			},
			workingDir,
		});

		return { restored: opened + existing, opened, existing, failed };
	} finally {
		reopening = false;
	}
}
