export const PROJECT_ACTION_GROUPS = ["cli", "comando", "docker", "git", "script"] as const;
export type ProjectActionGroup = (typeof PROJECT_ACTION_GROUPS)[number];

export const PROJECT_ACTION_MODES = ["background", "terminal"] as const;
export type ProjectActionMode = (typeof PROJECT_ACTION_MODES)[number];

export const PROJECT_ACTION_GROUP_LABELS: Record<ProjectActionGroup, string> = {
	comando: "Comandos",
	docker: "Docker",
	git: "Git",
	script: "Scripts do package.json",
	cli: "Agentes",
};
