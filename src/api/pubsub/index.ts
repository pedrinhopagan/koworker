import { MemoryPublisher } from "@orpc/experimental-publisher/memory";

const publisher = new MemoryPublisher<Record<string, object>>();

type PubSubChannels = {
	notification: {
		title: string;
		message: string;
	};
};

export const PubSub = {
	subscribe<T extends keyof PubSubChannels>(type: T, uuid: string, signal?: AbortSignal) {
		const key = `${type}:${uuid}`;

		return publisher.subscribe(key, { signal }) as AsyncIterable<PubSubChannels[T]>;
	},

	publish<T extends keyof PubSubChannels>(type: T, uuid: string, data: PubSubChannels[T]) {
		const key = `${type}:${uuid}`;

		return publisher.publish(key, data);
	},
};
