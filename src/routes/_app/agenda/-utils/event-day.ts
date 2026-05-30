import dayjs from "dayjs";

// Gêmeo no frontend da query de overlap do listByRange. Um event [start, end) "toca" o dia D se
// start < (D+1dia)T00:00 E end > D T00:00 — comparando contra bounds datetime COMPLETOS, nunca
// date-only. Mesma armadilha lexicográfica: um all-day terminando 'D+1 T00:00' NÃO acende o dia
// D+1 (end > dayStart é falso por igualdade), evitando chip-fantasma.
export function eventTouchesDay(event: { startAt: string; endAt: string }, date: string) {
	const dayStart = `${date}T00:00`;
	const nextDayStart = `${dayjs(date).add(1, "day").format("YYYY-MM-DD")}T00:00`;

	return event.startAt < nextDayStart && event.endAt > dayStart;
}

// Distribui os events nas células de dia: cada event aparece uma vez por célula que cobre (um chip
// por célula, sem barra-spanning no v1). Ordena por start_at dentro de cada dia (já vem ordenado
// do backend, mas garantimos a estabilidade por célula).
export function bucketEventsByDay<E extends { startAt: string; endAt: string }>(
	events: E[],
	dates: string[],
) {
	const byDay = new Map<string, E[]>();

	for (const date of dates) {
		byDay.set(
			date,
			events.filter((event) => eventTouchesDay(event, date)),
		);
	}

	return byDay;
}
