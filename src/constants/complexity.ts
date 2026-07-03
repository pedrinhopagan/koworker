// Complexidade da tarefa: fonte única do conjunto finito. O banco guarda texto livre (o DSL de
// tabelas não expressa CHECK), então a garantia do conjunto vive aqui — a boundary zod usa
// `z.enum(TASK_COMPLEXITIES)` e o resto (cores, labels, ordenação, UI) deriva desta constante.
export const TASK_COMPLEXITIES = ["simples", "medio", "complexo", "extremo"] as const;

export type TaskComplexity = (typeof TASK_COMPLEXITIES)[number];

export const COMPLEXITY_LABELS: Record<TaskComplexity, string> = {
	simples: "Simples",
	medio: "Médio",
	complexo: "Complexo",
	extremo: "Extremo",
};

// Verde → azul → laranja → vermelho: escala crescente de esforço. Hex da paleta de domínio.
export const COMPLEXITY_COLORS: Record<TaskComplexity, string> = {
	simples: "#22c55e",
	medio: "#3b82f6",
	complexo: "#f97316",
	extremo: "#ef4444",
};

// Etapas de um fluxo de tarefa. A ordem de cada complexidade vive em COMPLEXITY_FLOWS; a etapa
// corrente é inferida pelos artefatos da pasta (ver inferTaskStage). No extremo o grill é com o
// usuário e a revisão é obrigatória.
export type TaskStage = "grill" | "plano" | "execucao" | "execucao-fases" | "revisao";

export const COMPLEXITY_FLOWS: Record<TaskComplexity, TaskStage[]> = {
	simples: ["execucao"],
	medio: ["plano", "execucao"],
	complexo: ["grill", "plano", "execucao"],
	extremo: ["grill", "plano", "execucao-fases", "revisao"],
};

// Cada etapa delega ao subagente que a executa. O slug bate com o agente em ~/.claude/agents.
export const STAGE_AGENT: Record<TaskStage, string> = {
	grill: "griller",
	plano: "planejador",
	execucao: "executor",
	"execucao-fases": "orquestrador",
	revisao: "revisor-execucao",
};
