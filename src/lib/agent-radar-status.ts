import type { LucideIcon } from "lucide-react";
import { Check, CircleAlert, CircleDashed, Minus } from "lucide-react";

import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import type { AgentRadarStatus } from "@/constants/agent-radar";

// O visual de cada status do radar em um só lugar: a rota, a faixa do pane e o placar leem daqui, pra
// "esperando você" ser sempre a mesma cor em toda a UI.
//
// A regra de leitura: amarelo de foco fica no chip do item (Target), não no fundo do cartão. Working
// anuncia movimento pela cobrinha e pela faixa lateral. Quem trava esperando resposta é o único que
// ganha superfície tingida (laranja), porque é o único que cobra ação.
export type AgentRadarVisual = {
	surface: string;
	edge: string;
	dot: string;
	badge: string;
	tone: string;
	icon: LucideIcon | null;
};

export const AGENT_RADAR_VISUALS: Record<AgentRadarStatus, AgentRadarVisual> = {
	working: {
		surface: "border-border bg-card hover:bg-muted/40",
		edge: "border-l-primary",
		dot: "bg-primary",
		badge: "border-primary/40 bg-primary/10 text-primary",
		tone: "text-primary",
		icon: null,
	},
	blocked: {
		surface: "border-warning/40 bg-warning/8 hover:bg-warning/15",
		edge: "border-l-warning",
		dot: "bg-warning",
		badge: "border-warning/50 bg-warning/20 text-warning",
		tone: "text-warning",
		icon: CircleAlert,
	},
	done: {
		surface: "border-border bg-card hover:bg-muted/40",
		edge: "border-l-success",
		dot: "bg-success",
		badge: "border-success/40 bg-success/10 text-success",
		tone: "text-success",
		icon: Check,
	},
	idle: {
		surface: "border-border/60 bg-card/50 hover:bg-muted/40",
		edge: "border-l-border",
		dot: "bg-muted-foreground",
		badge: "border-border bg-muted text-muted-foreground",
		tone: "text-muted-foreground",
		icon: Minus,
	},
	unknown: {
		surface: "border-dashed border-border/60 bg-transparent hover:bg-muted/30",
		edge: "border-l-border",
		dot: "bg-border",
		badge: "border-dashed border-border text-muted-foreground",
		tone: "text-muted-foreground",
		icon: CircleDashed,
	},
};

// Quem cobra ação sobe: primeiro o bloqueado, depois quem está trabalhando, e dentro do mesmo status
// o que mudou mais recentemente. A rota e o placar da home ordenam pela mesma régua.
const STATUS_WEIGHT: Record<AgentRadarStatus, number> = {
	blocked: 0,
	working: 1,
	done: 2,
	idle: 3,
	unknown: 4,
};

export function sortRadarAgents(agents: RadarAgent[]): RadarAgent[] {
	return [...agents].sort(function (left, right) {
		const weight = STATUS_WEIGHT[left.status] - STATUS_WEIGHT[right.status];

		if (weight === 0) {
			return right.changedAt - left.changedAt;
		}

		return weight;
	});
}
