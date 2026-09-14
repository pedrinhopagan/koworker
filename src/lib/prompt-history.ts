import { orpc, type RouterInputs } from "@/client";

// Prompt copiado pelo clipboard é o único que não deixa transcript em disco: fica registrado aqui para
// aparecer no histórico ao lado do que as CLIs gravaram. Fire-and-forget: a cópia já aconteceu.
export function recordCopiedPrompt(input: RouterInputs["promptHistory"]["recordCopy"]) {
	void orpc.promptHistory.recordCopy.call(input).catch(() => {});
}
