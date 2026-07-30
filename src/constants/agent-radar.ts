// Status de agent do kw-terminal: enum fechado do daemon, replicado aqui como conjunto finito de
// domínio. A boundary zod do watcher valida contra esta constante e a UI deriva rótulo e cor dela.
export const AGENT_RADAR_STATUSES = ["working", "blocked", "done", "idle", "unknown"] as const;

export type AgentRadarStatus = (typeof AGENT_RADAR_STATUSES)[number];

export const AGENT_RADAR_STATUS_LABELS: Record<AgentRadarStatus, string> = {
	working: "Trabalhando",
	blocked: "Esperando você",
	done: "Terminou",
	idle: "Parado",
	unknown: "Sem sinal",
};

// Só transição para estes status vira notificação: o agent terminou o trabalho ou parou esperando
// resposta. `idle` fica de fora porque é o repouso normal entre um turno e outro.
export const AGENT_RADAR_ALERT_STATUSES: AgentRadarStatus[] = ["done", "blocked"];
