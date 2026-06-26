import { orpc, type RouterInputs } from "@/client";

// Registra de forma durável (SQLite no backend) cada prompt despachado pela barra, para análise
// futura. Fire-and-forget: é um log de observação, não pode atrasar nem quebrar a ação do usuário,
// então a falha é engolida — o disparo do prompt em si já aconteceu.
export function recordPromptHistory(input: RouterInputs["promptHistory"]["record"]) {
	void orpc.promptHistory.record.call(input).catch(() => {});
}
