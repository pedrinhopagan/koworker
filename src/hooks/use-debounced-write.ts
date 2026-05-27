import { useCallback, useEffect, useRef } from "react";

// Acumula a última escrita e grava após `delayMs`. `flush` grava imediatamente o que
// estiver pendente (usado antes de enviar prompt, trocar de arquivo ou desmontar).
export function useDebouncedWrite<T>(write: (payload: T) => Promise<unknown>, delayMs = 600) {
	const pending = useRef<T | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const writeRef = useRef(write);
	writeRef.current = write;

	const flush = useCallback(async () => {
		if (timer.current) {
			clearTimeout(timer.current);
			timer.current = null;
		}

		const payload = pending.current;
		pending.current = null;
		if (payload !== null) {
			await writeRef.current(payload);
		}
	}, []);

	const schedule = useCallback(
		(payload: T) => {
			pending.current = payload;
			if (timer.current) clearTimeout(timer.current);
			timer.current = setTimeout(() => void flush(), delayMs);
		},
		[flush, delayMs],
	);

	useEffect(() => () => void flush(), [flush]);

	return { schedule, flush };
}
