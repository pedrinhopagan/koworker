export const RECENCY_HIGHLIGHT_DEPTH = 3;

export const TASK_RECENCY_HIGHLIGHT_DEPTH = 5;

export const RECENCY_IGNORE_OFFSET_MS = 10 * 24 * 60 * 60 * 1000;

// Janela de frescor do destaque da LISTA de tarefas: só ganha barra/relógio quem foi editado
// dentro dela — sem isso, uma tarefa parada há meses seguiria "destacada como recente". Não vale
// pro ranking de arquivos dentro de uma tarefa (lá o objetivo é sempre saber qual é o mais
// recente, mesmo que todos sejam antigos) nem pro modo de ordenação "Recente".
export const RECENCY_FRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Nível de recência (1 = mais recente) → peso da cor primária. Mesmo idioma visual na barra
// lateral da lista de tarefas e nos pontos das abas de arquivo da rota da tarefa.
export function recencyLevelClass(level: number): string {
	if (level === 1) return "bg-primary";
	if (level === 2) return "bg-primary/55";
	return "bg-primary/30";
}
