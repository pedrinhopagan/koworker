import { MemoryPublisher } from "@orpc/experimental-publisher/memory";

const publisher = new MemoryPublisher<Record<string, object>>();

type PubSubChannels = {
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
