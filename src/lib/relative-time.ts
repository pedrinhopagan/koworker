import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/pt-br";

dayjs.extend(relativeTime);

// Tempo relativo em pt-BR (ex.: "há 5 minutos"). Locale por chamada pra não mexer no
// dayjs global do backend.
export function relativeTimeFrom(ms: number) {
	return dayjs(ms).locale("pt-br").fromNow();
}

// Data e hora absolutas (ex.: "28/05/2026 14:32"), pro rodapé de criação/atualização do arquivo.
export function formatDateTime(ms: number) {
	return dayjs(ms).locale("pt-br").format("DD/MM/YYYY HH:mm");
}

// Cabeçalho de um bloco de lista agrupada por dia: "Hoje", "Ontem" ou a data por extenso.
export function formatDayLabel(ms: number) {
	const day = dayjs(ms).locale("pt-br").startOf("day");
	const distance = dayjs().startOf("day").diff(day, "day");

	if (distance === 0) {
		return "Hoje";
	}
	if (distance === 1) {
		return "Ontem";
	}

	return day.format("D [de] MMMM [de] YYYY");
}

// Quanto tempo durou algo, em passo grosso: a conversa de ontem não precisa de segundos.
export function formatDuration(fromMs: number, toMs: number) {
	const minutes = Math.max(0, Math.round((toMs - fromMs) / 60_000));

	if (minutes < 1) {
		return "menos de 1 min";
	}
	if (minutes < 60) {
		return `${minutes} min`;
	}

	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;

	return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

// Valor pro <input type="datetime-local"> a partir de ms (horário local, precisão de minuto).
export function toDateTimeLocalValue(ms: number) {
	return dayjs(ms).format("YYYY-MM-DDTHH:mm");
}

// ms a partir do valor do <input type="datetime-local"> (horário local). NaN se inválido.
export function dateTimeLocalToMs(value: string) {
	return dayjs(value).valueOf();
}
