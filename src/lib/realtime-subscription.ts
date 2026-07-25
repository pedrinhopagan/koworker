const RETRY_MIN_MS = 500;
const RETRY_MAX_MS = 15_000;

function wait(ms: number) {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});
}

export async function subscribeWithRetry<T>(input: {
	label: string;
	signal: AbortSignal;
	subscribe: (signal: AbortSignal) => Promise<AsyncIterable<T>>;
	onEvent: (event: T) => void;
	onReconnect?: () => void;
}) {
	let retryDelay = RETRY_MIN_MS;
	let attempts = 0;

	while (!input.signal.aborted) {
		try {
			const events = await input.subscribe(input.signal);
			retryDelay = RETRY_MIN_MS;

			if (attempts > 0) {
				input.onReconnect?.();
			}

			for await (const event of events) {
				input.onEvent(event);
			}
		} catch (error) {
			if (input.signal.aborted) {
				return;
			}

			console.error(`[${input.label}] Erro na subscription:`, error);
		}

		if (input.signal.aborted) {
			return;
		}

		attempts += 1;
		await wait(retryDelay);
		retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
	}
}
