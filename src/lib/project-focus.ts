import type { LinkProps, RegisteredRouter } from "@tanstack/react-router";

export const ALL_PROJECTS_ID = "__all_projects__";

export const DISABLED_PATHS = new Set<LinkProps<RegisteredRouter>["to"]>(["/projetos/novo"]);

export const REDIRECT_ON_SELECT_PATHS = new Map<
	LinkProps<RegisteredRouter>["to"],
	LinkProps<RegisteredRouter>["to"]
>([
	["/tarefas/$taskId", "/tarefas"],
	["/tarefas/$taskId/$file", "/tarefas"],
	["/tarefas/$taskId/$file/$canonicalFile", "/tarefas"],
]);
