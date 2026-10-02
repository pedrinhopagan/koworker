import { expect, test } from "bun:test";

import { subscribeWithRetry } from "./realtime-subscription";

test("conexão só fica pronta com primeiro evento e ignora eventos depois do cancelamento", async () => {
	const controller = new AbortController();
	const states: boolean[] = [];
	const events: number[] = [];
	await subscribeWithRetry({
		label: "Teste",
		signal: controller.signal,
		subscribe: async () => {
			expect(states).toEqual([]);
			await Promise.resolve();
			return (async function* () {
				yield 1;
				yield 2;
			})();
		},
		onConnectionChange: (state) => states.push(state),
		onEvent: (event) => {
			events.push(event);
			controller.abort();
		},
	});
	expect(states).toEqual([true]);
	expect(events).toEqual([1]);
});
