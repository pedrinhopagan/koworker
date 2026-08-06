// Status de agent do kw-terminal: enum fechado do daemon, replicado aqui como conjunto finito de
// domínio. A boundary zod do watcher valida contra esta constante e a UI deriva rótulo e cor dela.
export const AGENT_RADAR_STATUSES = ["working", "blocked", "done", "idle", "unknown"] as const;

export type AgentRadarStatus = (typeof AGENT_RADAR_STATUSES)[number];

const AGENT_RADAR_AGENT_LABELS: Record<string, string> = {
	"prime-agent": "Prime Agent",
	pi: "Pi",
};

export function agentRadarAgentLabel(agent: string) {
	return AGENT_RADAR_AGENT_LABELS[agent] ?? agent;
}

export const AGENT_RADAR_STATUS_LABELS: Record<AgentRadarStatus, string> = {
	working: "Trabalhando",
	blocked: "Esperando você",
	done: "Terminou",
	idle: "Parado",
	unknown: "Sem sinal",
};

// O daemon separa "terminou o turno" de "travou perguntando", mas para quem acompanha de longe os dois
// cobram a mesma coisa: voltar pro terminal. Então `done` entra no radar como `blocked` e o koworker
// tem um estado só de "é a sua vez".
export function normalizeAgentRadarStatus(status: AgentRadarStatus): AgentRadarStatus {
	return status === "done" ? "blocked" : status;
}

// Só transição para este status vira notificação: o agent parou e a vez é sua. `idle` fica de fora
// porque é o repouso normal entre um turno e outro.
export const AGENT_RADAR_ALERT_STATUSES: AgentRadarStatus[] = ["blocked"];
