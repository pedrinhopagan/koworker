import { useEffect, useState } from "react";

// Segundos desde `from` (epoch ms) enquanto `active`: é o relógio do "trabalhando há X" que mostra
// que o agent não travou. Pausa o intervalo quando ninguém está trabalhando.
export function useElapsedSeconds(from: number | null | undefined, active: boolean) {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (!active) {
			return;
		}

		setNow(Date.now());
		const timer = setInterval(() => setNow(Date.now()), 1_000);

		return () => clearInterval(timer);
	}, [active]);

	if (!from || from > now) {
		return null;
	}

	return Math.max(0, Math.round((now - from) / 1000));
}

export function formatElapsedSeconds(seconds: number) {
	if (seconds < 60) {
		return `${seconds}s`;
	}

	const minutes = Math.floor(seconds / 60);
	const rest = seconds % 60;

	if (minutes < 60) {
		return `${minutes}m ${String(rest).padStart(2, "0")}s`;
	}

	const hours = Math.floor(minutes / 60);

	return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}
