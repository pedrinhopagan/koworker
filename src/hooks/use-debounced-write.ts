import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { DocSaveStatus } from "@/components/ui/save-status";

const RETRY_DELAY_MS = 3_000;

// Acumula a última escrita e grava após `delayMs`. `flush` grava imediatamente o que
// estiver pendente (usado antes de enviar prompt, trocar de arquivo ou desmontar).
export function useDebouncedWrite<T>(write: (payload: T) => Promise<unknown>, delayMs = 600) {
	const pending = useRef<T | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const writeRef = useRef(write);
	writeRef.current = write;
	const [status, setStatus] = useState<DocSaveStatus>("idle");

	const clearTimer = useCallback(() => {
		if (timer.current) {
			clearTimeout(timer.current);
			timer.current = null;
		}
	}, []);

	const flush = useCallback(async () => {
		clearTimer();

		const payload = pending.current;
		if (payload === null) {
			return;
		}

		pending.current = null;
		setStatus("saving");

		try {
			await writeRef.current(payload);
			setStatus("saved");
		} catch (error) {
			pending.current = payload;
			setStatus("error");
			toast.error(error instanceof Error ? error.message : "Não foi possível salvar o arquivo");
			timer.current = setTimeout(() => void flush(), RETRY_DELAY_MS);
		}
	}, [clearTimer]);

	const schedule = useCallback(
		(payload: T) => {
			pending.current = payload;
			setStatus("saving");
			clearTimer();
			timer.current = setTimeout(() => void flush(), delayMs);
		},
		[clearTimer, flush, delayMs],
	);

	useEffect(() => () => void flush(), [flush]);

	return { schedule, flush, status };
}
