import dayjs, { type Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

export function toDateStr(input: string | Date | Dayjs) {
  return djs(input).format("YYYY-MM-DD");
}

export const djs = dayjs;
