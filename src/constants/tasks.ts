export const RECENCY_HIGHLIGHT_DEPTH = 3;

export const TASK_RECENCY_HIGHLIGHT_DEPTH = 5;

export const TASK_GROUP_COLORS = [
	"#6366f1",
	"#0ea5e9",
	"#10b981",
	"#f59e0b",
	"#ef4444",
	"#a855f7",
	"#ec4899",
	"#14b8a6",
	"#84cc16",
	"#f97316",
	"#06b6d4",
	"#d946ef",
] as const;

export const DEFAULT_TASK_GROUP_COLOR = TASK_GROUP_COLORS[0];

export function pickTaskGroupColor(existingColors: string[]) {
	const usage = new Map<string, number>(TASK_GROUP_COLORS.map((color) => [color, 0]));

	for (const existingColor of existingColors) {
		const color = existingColor.trim().toLowerCase();
		const count = usage.get(color);
		if (count !== undefined) usage.set(color, count + 1);
	}

	return TASK_GROUP_COLORS.reduce((selected, color) =>
		(usage.get(color) ?? 0) < (usage.get(selected) ?? 0) ? color : selected,
	);
}

export const TASK_SORT_MODES = [
	{ mode: "recente", label: "Recente" },
	{ mode: "categoria", label: "Categoria" },
	{ mode: "prioridade", label: "Prioridade" },
	{ mode: "complexidade", label: "Complexidade" },
	{ mode: "alfabetica", label: "A-Z" },
] as const;

export type TaskSortMode = (typeof TASK_SORT_MODES)[number]["mode"];

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
