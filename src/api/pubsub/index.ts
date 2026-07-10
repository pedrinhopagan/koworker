import { MemoryPublisher } from "@orpc/experimental-publisher/memory";

import type { TaskStage } from "@/constants/complexity";

const publisher = new MemoryPublisher<Record<string, object>>();

// Progresso do fluxo autônomo de uma tarefa, publicado por taskId. `stage`/`agent` nomeiam o que
// está rodando (null na revisão final e no arranque); `message` carrega só o fato que o frontend não
// deriva sozinho — o motivo da falha (timeout × código) ou a nota de por que parou no usuário.
export type FlowEvent = {
	taskId: string;
	status: "running" | "waiting-user" | "failed" | "completed";
	stage: TaskStage | null;
	agent: string | null;
	message: string | null;
};

export type PromptRunEvent = {
	runId: string;
	status: "started" | "done" | "failed" | "timeout";
	output?: string;
	error?: string;
};

type PubSubChannels = {
	flow: FlowEvent;
	promptRun: PromptRunEvent;
	notification: {
		title: string;
		message: string;
	};
	tasks: {
		// Ausente quando o evento vem do watcher de FS (não sabe qual task mudou).
		taskId?: string;
		projectId: string;
		action: "created" | "updated" | "deleted";
		source: "api" | "cli" | "fs";
	};
};

export type TerminalEventType =
	| "session_opened"
	| "session_closed"
	| "window_opened"
	| "window_closed";

export type TerminalEvent = {
	eventType: TerminalEventType;
	projectId: string;
	taskId?: string;
	sessionName: string;
	windowName?: string;
};

const TERMINAL_CHANNEL = "terminal:global";

export const PubSub = {
	subscribe<T extends keyof PubSubChannels>(type: T, uuid: string, signal?: AbortSignal) {
		const key = `${type}:${uuid}`;

		return publisher.subscribe(key, { signal }) as AsyncIterable<PubSubChannels[T]>;
	},

	publish<T extends keyof PubSubChannels>(type: T, uuid: string, data: PubSubChannels[T]) {
		const key = `${type}:${uuid}`;

		return publisher.publish(key, data);
	},

	terminal: {
		subscribe(signal?: AbortSignal) {
			return publisher.subscribe(TERMINAL_CHANNEL, { signal }) as AsyncIterable<TerminalEvent>;
		},

		publish(data: TerminalEvent) {
			return publisher.publish(TERMINAL_CHANNEL, data);
		},
	},
};
