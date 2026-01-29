import { provedorMock } from "./mock";
import type { IdProvedor, Provedor } from "./types";

function criarProvedorNaoImplementado(id: IdProvedor, nome: string): Provedor {
	const erro = (): never => {
		throw new Error(`Provedor ${nome} nao implementado`);
	};

	return {
		id,
		nome,
		iniciar: () => erro(),
		cancelar: () => erro(),
		eventos: () => erro(),
	};
}

const provedores: Record<IdProvedor, Provedor> = {
	mock: provedorMock,
	opencode: criarProvedorNaoImplementado("opencode", "OpenCode"),
	codex: criarProvedorNaoImplementado("codex", "Codex"),
	claude: criarProvedorNaoImplementado("claude", "Claude"),
};

export function obterProvedor(id: IdProvedor): Provedor {
	return provedores[id];
}

export const listaProvedores = Object.values(provedores);
