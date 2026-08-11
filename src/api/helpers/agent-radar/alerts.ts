import {
	AGENT_RADAR_ALERT_STATUSES,
	AGENT_RADAR_STATUS_LABELS,
	type AgentRadarStatus,
} from "@/constants/agent-radar";
import { DbUsers } from "../../db/users";
import { PubSub } from "../../pubsub";
import { PushNotifications } from "../push-notifications";
import type { RadarAgent } from "./state";

// O alerta é da transição, não do estado corrente: o agent cai em `idle` logo depois de devolver a vez,
// então notificar pelo estado atual chegaria descrevendo algo que já mudou.
export function shouldAlertTransition(previous: AgentRadarStatus, next: AgentRadarStatus): boolean {
	return previous !== next && AGENT_RADAR_ALERT_STATUSES.includes(next);
}

function alertText(agent: RadarAgent) {
	const label = AGENT_RADAR_STATUS_LABELS[agent.status];

	return {
		title: `${agent.agent} · ${agent.workspaceLabel}`,
		body: agent.activity ? `${label}: ${agent.activity}` : label,
	};
}

// Push para todo aparelho aprovado e aviso in-app na mesma batida: o desktop roda no Electron, onde não
// existe service worker, e só enxerga o alerta pelo canal de notificação. O `tag` por pane faz a
// notificação nova substituir a anterior daquele agent em vez de empilhar.
export async function alertRadarTransition(agent: RadarAgent) {
	const { title, body } = alertText(agent);
	const userIds = await DbUsers.listIds();

	await Promise.all(
		userIds.flatMap((userId) => [
			PubSub.publish("notification", String(userId), { title, message: body }),
			PushNotifications.send(userId, {
				title,
				body,
				url: "/terminals",
				tag: `kowork-radar-${agent.paneId}`,
				requireInteraction: agent.status === "blocked",
			}).catch((error: unknown) => {
				console.error("[Radar] Falha ao enviar push:", error);
			}),
		]),
	);
}
