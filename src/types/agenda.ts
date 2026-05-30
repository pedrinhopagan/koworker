import type { RouterOutputs } from "@/client";

// Evento da agenda, derivado da saída do router (fonte única). displayTitle/displayColor já vêm
// resolvidos no boundary (title do evento ou da task linkada; cor explícita ou da categoria).
export type AgendaEvent = RouterOutputs["events"]["listByRange"][number];
