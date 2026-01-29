export const idsProvedor = ["mock", "opencode", "codex", "claude"] as const;

export type IdProvedor = (typeof idsProvedor)[number];

export type StatusExecucao = "inicializando" | "rodando" | "finalizado" | "erro";

export type EventoProvedor =
	| { tipo: "status"; status: StatusExecucao; mensagem?: string }
	| { tipo: "log"; nivel: "info" | "aviso" | "erro"; mensagem: string }
	| {
			tipo: "tarefa";
			tarefaId: string;
			status: "iniciado" | "progresso" | "finalizado";
			mensagem?: string;
	  };

export type EntradaExecucao = {
	tarefaId: string;
	prompt: string;
	contexto?: Record<string, unknown>;
};

export type SaidaExecucao = {
	execucaoId: string;
};

export type Provedor = {
	id: IdProvedor;
	nome: string;
	iniciar: (entrada: EntradaExecucao) => Promise<SaidaExecucao>;
	cancelar: (execucaoId: string) => Promise<void>;
	eventos: (execucaoId: string) => AsyncIterable<EventoProvedor>;
};
