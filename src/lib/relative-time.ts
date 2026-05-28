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

// Valor pro <input type="datetime-local"> a partir de ms (horário local, precisão de minuto).
export function toDateTimeLocalValue(ms: number) {
	return dayjs(ms).format("YYYY-MM-DDTHH:mm");
}

// ms a partir do valor do <input type="datetime-local"> (horário local). NaN se inválido.
export function dateTimeLocalToMs(value: string) {
	return dayjs(value).valueOf();
}
