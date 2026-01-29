import type { EntradaExecucao, EventoProvedor, Provedor, SaidaExecucao } from "./types";

function iniciar(_: EntradaExecucao): Promise<SaidaExecucao> {
	return Promise.resolve({ execucaoId: crypto.randomUUID() });
}

function cancelar(_: string): Promise<void> {
	return Promise.resolve();
}

async function* eventos(_: string): AsyncIterable<EventoProvedor> {
	yield { tipo: "status", status: "inicializando" };
	yield { tipo: "status", status: "rodando" };
	yield { tipo: "status", status: "finalizado" };
}

export const provedorMock: Provedor = {
	id: "mock",
	nome: "Mock",
	iniciar,
	cancelar,
	eventos,
};
