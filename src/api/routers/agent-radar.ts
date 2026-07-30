import { ORPCError } from "@orpc/server";

import { protectedProcedure } from "../auth/context";
import {
	clearAgentSessionSnapshot,
	listAgentSessionSnapshot,
	restoreAgentSessionSnapshot,
} from "../helpers/agent-radar/restore";
import { type RadarAgent, getRadarAgent } from "../helpers/agent-radar/state";
import { openKwDiff } from "../helpers/kw-diff";
import {
	ensureKwTerminalServer,
	kwTerminalAgentFocus,
	kwTerminalAgentSend,
	kwTerminalPaneClose,
	kwTerminalPaneSendKeys,
} from "../helpers/terminal/kw-terminal";
import { revealKwTerminalClient } from "../helpers/terminal/service";
import { getSystemSettings } from "../helpers/system-settings";
import { AgentRadarPaneSchema, AgentRadarSendSchema } from "../schemas/agent-radar";

function agentOrThrow(paneId: string): RadarAgent {
	const agent = getRadarAgent(paneId);
	if (!agent) {
		throw new ORPCError("NOT_FOUND", { message: "Este agent não está mais aberto no terminal" });
	}

	return agent;
}

export const agentRadarRouter = {
	// Responder do celular é escrever no prompt do agent e apertar Enter, em dois passos porque o
	// `agent send` escreve literal de propósito. A mensagem só aparece na conversa quando volta pelo
	// transcript: o arquivo do CLI é a fonte da verdade, não o que o app achou que enviou.
	send: protectedProcedure.input(AgentRadarSendSchema).handler(async ({ input }) => {
		agentOrThrow(input.paneId);

		await kwTerminalAgentSend(input.paneId, input.text);
		await kwTerminalPaneSendKeys(input.paneId, "Enter");

		return { sent: true };
	}),

	// Levar o agent pra tela do terminal: `agent focus` aceita pane id e já move workspace, tab e pane
	// no daemon; a janela do cliente TUI vem depois, pra o foco não ficar só no estado interno.
	focus: protectedProcedure.input(AgentRadarPaneSchema).handler(async ({ input }) => {
		const agent = agentOrThrow(input.paneId);
		await ensureKwTerminalServer();

		if (!(await kwTerminalAgentFocus(input.paneId))) {
			throw new Error("Falha ao focar o agent no kw-terminal");
		}

		const settings = await getSystemSettings();
		await revealKwTerminalClient({
			config: {
				template: settings.terminalTemplate,
				multiplexer: settings.terminalMultiplexer,
			},
			workingDir: agent.cwd,
		});

		return { ok: true };
	}),

	// O kw-diff revisa por diretório, então o alvo é o cwd onde o agent foi aberto — é lá que estão as
	// mudanças que ele fez.
	openDiff: protectedProcedure.input(AgentRadarPaneSchema).handler(async ({ input }) => {
		const agent = agentOrThrow(input.paneId);
		await openKwDiff(agent.cwd);

		return { cwd: agent.cwd };
	}),

	// Fecha só o pane do agent: a tab pode ter outros panes, e quem quer derrubar a tab inteira usa a
	// ação da tab.
	close: protectedProcedure.input(AgentRadarPaneSchema).handler(async ({ input }) => {
		agentOrThrow(input.paneId);
		await ensureKwTerminalServer();

		if (!(await kwTerminalPaneClose(input.paneId))) {
			throw new Error("Falha ao fechar o pane no kw-terminal");
		}

		return { ok: true };
	}),

	// O retrato do que estava aberto na última vez que o radar viu algum agent. É o que a rota mostra
	// depois de um desligamento: o daemon morreu com a máquina e o radar volta vazio.
	snapshot: protectedProcedure.handler(async () => {
		const rows = await listAgentSessionSnapshot();

		return {
			capturedAt: rows[0]?.captured_at ?? null,
			sessions: rows.map((row) => ({
				id: row.id,
				agent: row.agent,
				status: row.status,
				cwd: row.cwd,
				workspaceLabel: row.workspace_label,
				tabLabel: row.tab_label,
				projectId: row.project_id ?? null,
				projectName: row.project_name ?? null,
				title: row.title ?? null,
				taskTitle: row.task_title ?? null,
				resumable: Boolean(row.session_id),
				restoredAt: row.restored_at ?? null,
			})),
		};
	}),

	restoreSnapshot: protectedProcedure.handler(() => restoreAgentSessionSnapshot()),

	discardSnapshot: protectedProcedure.handler(async () => {
		await clearAgentSessionSnapshot();

		return { ok: true };
	}),
};
