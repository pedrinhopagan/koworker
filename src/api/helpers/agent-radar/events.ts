import { z } from "zod";

import { AGENT_RADAR_STATUSES } from "@/constants/agent-radar";

// Fronteira do socket do kw-terminal. O daemon fala JSON linha a linha em dois formatos: os eventos
// de ciclo de vida chegam com o nome em snake_case (`pane_exited`) e os de assinatura por pane com o
// nome pontuado (`pane.agent_status_changed`). Quem consome já recebe o shape interno.
const AgentStatusSchema = z.enum(AGENT_RADAR_STATUSES);

const AgentStatusChangedSchema = z.object({
	event: z.literal("pane.agent_status_changed"),
	data: z.object({
		pane_id: z.string(),
		workspace_id: z.string(),
		agent_status: AgentStatusSchema,
		agent: z.string().optional(),
		activity: z.string().optional(),
		title: z.string().optional(),
		display_agent: z.string().optional(),
	}),
});

const AgentDetectedSchema = z.object({
	event: z.literal("pane_agent_detected"),
	data: z.object({
		pane_id: z.string(),
		workspace_id: z.string(),
		agent: z.string().optional(),
	}),
});

const PaneExitedSchema = z.object({
	event: z.literal("pane_exited"),
	data: z.object({ pane_id: z.string() }),
});

const PaneClosedSchema = z.object({
	event: z.literal("pane_closed"),
	data: z.object({ pane_id: z.string() }),
});

const WorkspaceClosedSchema = z.object({
	event: z.literal("workspace_closed"),
	data: z.object({ workspace_id: z.string() }),
});

const WorkspaceRenamedSchema = z.object({
	event: z.literal("workspace_renamed"),
	data: z.object({ workspace_id: z.string(), label: z.string() }),
});

const TabRenamedSchema = z.object({
	event: z.literal("tab_renamed"),
	data: z.object({ tab_id: z.string(), label: z.string() }),
});

const WorkspaceFocusedSchema = z.object({
	event: z.literal("workspace_focused"),
	data: z.object({ workspace_id: z.string() }),
});

const TabFocusedSchema = z.object({
	event: z.literal("tab_focused"),
	data: z.object({ tab_id: z.string(), workspace_id: z.string() }),
});

const PaneFocusedSchema = z.object({
	event: z.literal("pane_focused"),
	data: z.object({ pane_id: z.string(), workspace_id: z.string() }),
});

const KwTerminalEventSchema = z.discriminatedUnion("event", [
	AgentStatusChangedSchema,
	AgentDetectedSchema,
	PaneExitedSchema,
	PaneClosedSchema,
	WorkspaceClosedSchema,
	WorkspaceRenamedSchema,
	TabRenamedSchema,
	WorkspaceFocusedSchema,
	TabFocusedSchema,
	PaneFocusedSchema,
]);

export type KwTerminalEvent = z.infer<typeof KwTerminalEventSchema>;

// Assinaturas do watcher. As de ciclo de vida são globais e cabem numa conexão só; a de status exige
// `pane_id`, então vive numa conexão por pane e vai sem filtro de status para pegar toda transição.
export const KW_TERMINAL_LIFECYCLE_SUBSCRIPTIONS = [
	{ type: "pane.agent_detected" },
	{ type: "pane.exited" },
	{ type: "pane.closed" },
	{ type: "workspace.closed" },
	{ type: "workspace.renamed" },
	{ type: "workspace.focused" },
	{ type: "tab.renamed" },
	{ type: "tab.focused" },
	{ type: "pane.focused" },
];

export function paneStatusSubscription(paneId: string) {
	return [{ type: "pane.agent_status_changed", pane_id: paneId }];
}

// A mesma conexão carrega o ack da assinatura e eventos que não pedimos; nada disso é erro, então a
// linha que não casa com nenhum evento conhecido é descartada em silêncio.
export function parseKwTerminalEvent(line: string): KwTerminalEvent | null {
	let payload: unknown;

	try {
		payload = JSON.parse(line);
	} catch {
		return null;
	}

	const parsed = KwTerminalEventSchema.safeParse(payload);

	return parsed.success ? parsed.data : null;
}
