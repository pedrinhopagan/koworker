import {
	type AgentSessionSnapshotRow,
	dbAgentSessionSnapshots,
} from "../../db/agent-session-snapshots";
import { getSystemSettings } from "../system-settings";
import { cliResumeArgv, type TerminalCli } from "../terminal/cli-argv";
import { terminalCommandText } from "../terminal/command";
import {
	ensureKwTerminalServer,
	findTabByLabel,
	findWorkspaceByLabel,
	kwTerminalAgentSend,
	kwTerminalPaneList,
	kwTerminalPaneRun,
	kwTerminalPaneSendKeys,
	kwTerminalTabCreate,
	kwTerminalWorkspaceCreate,
} from "../terminal/kw-terminal";
import { revealKwTerminalClient } from "../terminal/service";

// Só estes dois CLIs sabem retomar uma conversa antiga; agent de outro binário fica no retrato mas não
// é restaurado, porque abrir o processo de novo não devolveria o histórico.
const RESUMABLE_CLIS: TerminalCli[] = ["claude", "codex"];

// O agent que estava trabalhando quando a máquina caiu perdeu o turno no meio, então a restauração
// devolve a vez a ele. É o mesmo "continue" que se digitaria no terminal.
const CONTINUE_PROMPT = "continue";

// O CLI leva alguns segundos para subir e ser reconhecido pelo daemon, e só depois aceita texto no
// prompt. Sem essa espera o "continue" iria para o shell.
const AGENT_WAIT_ATTEMPTS = 60;
const AGENT_WAIT_INTERVAL_MS = 1_000;

let restoring = false;

function resumableCli(agent: string): TerminalCli | null {
	return RESUMABLE_CLIS.find((cli) => cli === agent) ?? null;
}

async function waitForAgent(paneId: string): Promise<boolean> {
	for (let attempt = 0; attempt < AGENT_WAIT_ATTEMPTS; attempt++) {
		await Bun.sleep(AGENT_WAIT_INTERVAL_MS);

		const pane = (await kwTerminalPaneList({}).catch(() => [])).find(
			(candidate) => candidate.pane_id === paneId,
		);

		if (!pane) {
			return false;
		}

		if (pane.agent) {
			return true;
		}
	}

	return false;
}

// O "continue" é disparado fora da chamada da rota: esperar o agent subir levaria dezenas de segundos
// e a restauração precisa responder na hora. Falha aqui é silenciosa de propósito — a tab já está
// aberta com a conversa retomada, e quem quiser cobrar o turno digita no terminal.
async function sendContinueWhenReady(paneId: string) {
	if (!(await waitForAgent(paneId))) {
		return;
	}

	try {
		await kwTerminalAgentSend(paneId, CONTINUE_PROMPT);
		await kwTerminalPaneSendKeys(paneId, "Enter");
	} catch (error) {
		console.error("[Radar] Falha ao retomar o turno do agent restaurado:", error);
	}
}

// A tab é procurada pelo label antes de ser criada: restaurar duas vezes (ou restaurar com o
// kw-terminal ainda de pé) não deve empilhar tabs iguais. Tab existente que já tem agent é dada como
// restaurada e não recebe comando nenhum.
async function openRestoredPane(row: AgentSessionSnapshotRow, workspaceId: string) {
	const existing = await findTabByLabel(workspaceId, row.tab_label);

	if (!existing) {
		const created = await kwTerminalTabCreate({
			workspaceId,
			cwd: row.cwd,
			label: row.tab_label,
			focus: false,
		});

		return { paneId: created.rootPane.pane_id, alreadyRunning: false };
	}

	const panes = await kwTerminalPaneList({ workspaceId, tabId: existing.tab_id });
	const pane = panes[0];

	if (!pane) {
		return null;
	}

	return { paneId: pane.pane_id, alreadyRunning: Boolean(pane.agent) };
}

async function restoreRow(row: AgentSessionSnapshotRow) {
	const cli = resumableCli(row.agent);
	if (!cli) {
		return null;
	}

	const workspace =
		(await findWorkspaceByLabel(row.workspace_label)) ??
		(await kwTerminalWorkspaceCreate({
			cwd: row.cwd,
			label: row.workspace_label,
			focus: false,
		}));

	const opened = await openRestoredPane(row, workspace.workspace_id);
	if (!opened) {
		return null;
	}

	if (opened.alreadyRunning) {
		return { id: row.id, continued: false };
	}

	await kwTerminalPaneRun(
		opened.paneId,
		terminalCommandText({ kind: "argv", argv: cliResumeArgv(cli, row.session_id) }),
	);

	const shouldContinue = row.status === "working";
	if (shouldContinue) {
		void sendContinueWhenReady(opened.paneId);
	}

	return { id: row.id, continued: shouldContinue };
}

export function listAgentSessionSnapshot() {
	return dbAgentSessionSnapshots.list();
}

export function clearAgentSessionSnapshot() {
	return dbAgentSessionSnapshots.clear();
}

// Sobe de uma vez tudo que estava aberto na última vez: um workspace por label do retrato, uma tab por
// agent e o CLI retomando a conversa de antes. Quem estava trabalhando ganha o "continue" assim que o
// daemon reconhece o agent.
export async function restoreAgentSessionSnapshot() {
	if (restoring) {
		throw new Error("Uma restauração já está em andamento");
	}

	restoring = true;

	try {
		const rows = await dbAgentSessionSnapshots.list();
		if (rows.length === 0) {
			throw new Error("Não há sessões guardadas para restaurar");
		}

		await ensureKwTerminalServer();

		const restored: { id: string; continued: boolean }[] = [];

		for (const row of rows) {
			try {
				const result = await restoreRow(row);
				if (result) {
					restored.push(result);
				}
			} catch (error) {
				console.error(`[Radar] Falha ao restaurar a sessão de ${row.agent} em ${row.cwd}:`, error);
			}
		}

		if (restored.length === 0) {
			throw new Error("Nenhuma sessão do retrato pôde ser restaurada");
		}

		await dbAgentSessionSnapshots.markRestored(restored.map((entry) => entry.id));

		const settings = await getSystemSettings();
		await revealKwTerminalClient({
			config: {
				template: settings.terminalTemplate,
				multiplexer: settings.terminalMultiplexer,
			},
			workingDir: rows[0]?.cwd ?? process.cwd(),
		});

		return {
			restored: restored.length,
			continued: restored.filter((entry) => entry.continued).length,
			skipped: rows.length - restored.length,
		};
	} finally {
		restoring = false;
	}
}
