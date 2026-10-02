import { useEffect } from "react";
import { create } from "zustand";

import type { RadarAgent, RadarFocus } from "@/api/schemas/terminal-workspace";
import { orpcWs } from "@/client";
import { subscribeWithRetry } from "@/lib/realtime-subscription";

// A assinatura abre com o mapa inteiro e cada mudança traz o mapa inteiro de novo, então o estado é
// sempre o último snapshot: reconexão não precisa remontar nada.
//
// O snapshot vive num store porque tem mais de um consumidor ao mesmo tempo (a rota /shells e o
// contador da sidebar). A assinatura é uma só, contada por consumidor: abre no primeiro que monta e
// fecha quando o último desmonta.
type RadarStore = {
	agents: RadarAgent[] | null;
	focus: RadarFocus;
};

const EMPTY_FOCUS: RadarFocus = { workspaceId: null, tabId: null, paneId: null };

const useRadarStore = create<RadarStore>(() => ({ agents: null, focus: EMPTY_FOCUS }));

function sameAgent(left: RadarAgent, right: RadarAgent) {
	return (Object.keys(left) as (keyof RadarAgent)[]).every((key) => left[key] === right[key]);
}

// O snapshot chega inteiro a cada transição de um único agent, e vem do JSON, então todo objeto é
// novo mesmo quando nada mudou. Aqui o cartão que continua igual continua sendo o mesmo objeto: é o
// que deixa a lista redesenhar só quem mudou, em vez de tudo a cada passo de qualquer agent.
export function reconcileRadarAgents(current: RadarAgent[] | null, incoming: RadarAgent[]) {
	if (!current) {
		return incoming;
	}

	const known = new Map(current.map((agent) => [agent.paneId, agent]));
	const next = incoming.map((agent) => {
		const previous = known.get(agent.paneId);

		return previous && sameAgent(previous, agent) ? previous : agent;
	});

	return next.length === current.length && next.every((agent, index) => agent === current[index])
		? current
		: next;
}

export function reconcileRadarFocus(current: RadarFocus, incoming: RadarFocus) {
	return current.workspaceId === incoming.workspaceId &&
		current.tabId === incoming.tabId &&
		current.paneId === incoming.paneId
		? current
		: incoming;
}

let consumers = 0;
let controller: AbortController | null = null;

function acquire() {
	consumers += 1;

	if (controller) {
		return;
	}

	controller = new AbortController();

	subscribeWithRetry({
		label: "Agent Radar",
		signal: controller.signal,
		subscribe: (signal) => orpcWs.agentRadar.call(undefined, { signal }),
		onEvent: function (event) {
			useRadarStore.setState(function (state) {
				return {
					agents: reconcileRadarAgents(state.agents, event.agents),
					focus: reconcileRadarFocus(state.focus, event.focus ?? EMPTY_FOCUS),
				};
			});
		},
	});
}

function release() {
	consumers -= 1;

	if (consumers > 0) {
		return;
	}

	controller?.abort();
	controller = null;
	useRadarStore.setState({ agents: null, focus: EMPTY_FOCUS });
}

export function useAgentRadar() {
	const agents = useRadarStore(function (state) {
		return state.agents;
	});
	const focus = useRadarStore(function (state) {
		return state.focus;
	});

	useEffect(function () {
		acquire();
		return release;
	}, []);

	return { agents: agents ?? [], focus, loading: agents === null };
}

// Quantos agents andam e quantos pararam esperando resposta. É o que a sidebar mostra no item Terminais.
export function useAgentRadarAttention() {
	const { agents } = useAgentRadar();

	return {
		working: agents.filter(function (agent) {
			return agent.status === "working";
		}).length,
		waiting: agents.filter(function (agent) {
			return agent.status === "blocked";
		}).length,
	};
}
