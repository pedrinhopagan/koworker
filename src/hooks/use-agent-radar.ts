import { useEffect } from "react";
import { create } from "zustand";

import type { RadarAgent, RadarFocus } from "@/api/helpers/agent-radar/state";
import { orpcWs } from "@/client";
import { subscribeWithRetry } from "@/lib/realtime-subscription";

// A assinatura abre com o mapa inteiro e cada mudança traz o mapa inteiro de novo, então o estado é
// sempre o último snapshot: reconexão não precisa remontar nada.
//
// O snapshot vive num store porque tem mais de um consumidor ao mesmo tempo (a rota /terminals e o
// contador da sidebar). A assinatura é uma só, contada por consumidor: abre no primeiro que monta e
// fecha quando o último desmonta.
type RadarStore = {
	agents: RadarAgent[] | null;
	focus: RadarFocus;
};

const EMPTY_FOCUS: RadarFocus = { workspaceId: null, tabId: null, paneId: null };

const useRadarStore = create<RadarStore>(() => ({ agents: null, focus: EMPTY_FOCUS }));

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
			useRadarStore.setState({
				agents: event.agents,
				focus: event.focus ?? EMPTY_FOCUS,
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
