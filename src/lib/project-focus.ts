import type { LinkProps, RegisteredRouter } from "@tanstack/react-router";

export const ALL_PROJECTS_ID = "__all_projects__";

export const DISABLED_PATHS = new Set<LinkProps<RegisteredRouter>["to"]>([
	"/projetos/$projetoId",
	"/projetos/novo",
	"/tarefas/$taskId",
	"/tarefas/$taskId/$file",
]);
