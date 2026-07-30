import type { RouterOutputs } from "@/client";

export type ExecutionRun = RouterOutputs["prompt"]["listRuns"][number];

export type Conversation = {
	id: string;
	latest: ExecutionRun;
	runIds: string[];
	turns: number;
};

// O histórico lista conversas, não turnos: depois que continuar virou o caminho normal, um mesmo
// trabalho apareceria repetido uma vez por resposta. O turno mais recente representa a conversa e
// carrega junto os ids dos outros para cancelar, repetir e limpar tudo de uma vez.
export function toConversations(runs: ExecutionRun[]): Conversation[] {
	const byThread = new Map<string, Conversation>();

	for (const run of runs) {
		const id = run.cliSessionId ?? run.runId;
		const conversation = byThread.get(id);
		if (!conversation) {
			byThread.set(id, { id, latest: run, runIds: [run.runId], turns: 1 });
			continue;
		}

		conversation.runIds.push(run.runId);
		conversation.turns += 1;
		if (run.startedAt > conversation.latest.startedAt) {
			conversation.latest = run;
		}
	}

	return [...byThread.values()].sort((a, b) => b.latest.startedAt - a.latest.startedAt);
}
