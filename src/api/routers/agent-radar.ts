import { ORPCError } from "@orpc/server";

import { protectedProcedure } from "../auth/context";
import { getSavedTerminals, reopenSavedTerminals } from "../helpers/agent-radar/terminal-restore";
import { type RadarAgent, getRadarAgent } from "../helpers/agent-radar/state";
import { refreshAgentRadarTranscript } from "../helpers/agent-radar/transcript";
import { agentRadarTranscriptPreviews } from "../helpers/agent-radar/transcript/preview";
import { syncPaneTranscriptSource } from "../helpers/agent-radar/transcript/sync";
import { openKwDiff } from "../helpers/kw-diff";
import {
	ensureKwTerminalServer,
	kwTerminalAgentFocus,
	kwTerminalAgentInterrupt,
	kwTerminalAgentSubmit,
	kwTerminalPaneClose,
} from "../helpers/terminal/kw-terminal";
import { revealKwTerminalClient } from "../helpers/terminal/service";
import { getSystemSettings } from "../helpers/system-settings";
import {
	AgentRadarInterruptSchema,
	AgentRadarPaneSchema,
	AgentRadarSendSchema,
} from "../schemas/agent-radar";

function agentOrThrow(paneId: string): RadarAgent {
	const agent = getRadarAgent(paneId);
	if (!agent) {
		throw new ORPCError("NOT_FOUND", { message: "Este agent não está mais aberto no terminal" });
	}

	return agent;
}

export const agentRadarRouter = {
	savedTerminals: protectedProcedure.handler(() => getSavedTerminals()),

	reopenSavedTerminals: protectedProcedure.handler(() => reopenSavedTerminals()),

	// Responder do celular é escrever no prompt do agent e apertar Enter, em dois passos porque o
	// `agent send` escreve literal de propósito. A mensagem só aparece na conversa quando volta pelo
	// transcript: o arquivo do CLI é a fonte da verdade, não o que o app achou que enviou.
	send: protectedProcedure.input(AgentRadarSendSchema).handler(async ({ input }) => {
		const revalidate = () => {
			const agent = agentOrThrow(input.paneId);
			if (agent.status === "working") {
				throw new ORPCError("CONFLICT", {
					message: "Aguarde o agent terminar ou interrompa antes",
				});
			}
		};

		await kwTerminalAgentSubmit(input.paneId, input.text, revalidate);

		return { sent: true };
	}),

	interrupt: protectedProcedure.input(AgentRadarInterruptSchema).handler(async ({ input }) => {
		agentOrThrow(input.paneId);
		await kwTerminalAgentInterrupt(input.paneId);

		return { ok: true };
	}),

	// A última fala de cada agent aberto, para a lista lateral. É uma chamada só para todos os panes:
	// cada cartão assinando a conversa inteira baixava o histórico completo de cada agent para
	// escrever uma linha de texto.
	transcriptPreviews: protectedProcedure.handler(() => agentRadarTranscriptPreviews()),

	syncTranscript: protectedProcedure.input(AgentRadarPaneSchema).handler(async ({ input }) => {
		agentOrThrow(input.paneId);
		const transcript = await syncPaneTranscriptSource(input.paneId);

		if (!transcript) {
			return { found: false };
		}

		await refreshAgentRadarTranscript(input.paneId);

		return { found: true };
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
};
