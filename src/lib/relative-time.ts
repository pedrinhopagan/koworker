import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/pt-br";

dayjs.extend(relativeTime);

// Tempo relativo em pt-BR (ex.: "há 5 minutos"). Locale por chamada pra não mexer no
// dayjs global do backend.
export function relativeTimeFrom(ms: number) {
	return dayjs(ms).locale("pt-br").fromNow();
}
