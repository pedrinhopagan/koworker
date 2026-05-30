import { djs } from "./dayjs";

// Duração default de um evento com horário mas sem fim informado. Nunca gravamos end == start:
// sob a query de overlap half-open [start, end) um evento de duração zero somVeria.
export const EVENT_DEFAULT_DURATION_MIN = 30;

// Calcula o end_at gravado (sempre exclusivo, sempre > start_at). Contrato único compartilhado
// pela criação/edição (router) e pela migração agenda→events.
// - all-day: `endAt` (quando vem) é o ÚLTIMO dia coberto (inclusive) → vira o dia seguinte
//   (exclusivo). Sem `endAt` → single all-day = dia seguinte ao start.
// - timed: usa o `endAt` informado quando > start; senão +EVENT_DEFAULT_DURATION_MIN.
export function normalizeEndAt(input: { startAt: string; endAt: string | null; allDay: boolean }) {
	if (input.allDay) {
		const lastDay = (input.endAt ?? input.startAt).slice(0, 10);
		return `${djs(lastDay).add(1, "day").format("YYYY-MM-DD")}T00:00`;
	}

	if (input.endAt && input.endAt > input.startAt) return input.endAt;

	return djs(input.startAt, "YYYY-MM-DDTHH:mm")
		.add(EVENT_DEFAULT_DURATION_MIN, "minute")
		.format("YYYY-MM-DDTHH:mm");
}
