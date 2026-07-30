import { ORPCError } from "@orpc/server";

import { protectedProcedure } from "../auth/context";
import { getRadarAgent } from "../helpers/agent-radar/state";
import { kwTerminalAgentSend, kwTerminalPaneSendKeys } from "../helpers/terminal/kw-terminal";
import { AgentRadarSendSchema } from "../schemas/agent-radar";

export const agentRadarRouter = {
	// Responder do celular é escrever no prompt do agent e apertar Enter, em dois passos porque o
	// `agent send` escreve literal de propósito. A mensagem só aparece na conversa quando volta pelo
	// transcript: o arquivo do CLI é a fonte da verdade, não o que o app achou que enviou.
	send: protectedProcedure.input(AgentRadarSendSchema).handler(async ({ input }) => {
		if (!getRadarAgent(input.paneId)) {
			throw new ORPCError("NOT_FOUND", { message: "Este agent não está mais aberto no terminal" });
		}

		await kwTerminalAgentSend(input.paneId, input.text);
		await kwTerminalPaneSendKeys(input.paneId, "Enter");

		return { sent: true };
	}),
};
