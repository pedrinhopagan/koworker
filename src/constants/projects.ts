// Rotas/atalhos de terminal que todo projeto novo recebe na criação: os agentes de CLI mais
// comuns, todos apontando para o main_route do projeto. Dono único — consumido por
// dbProjects.create (UI e CLI passam pelo mesmo caminho). O usuário renomeia/remove depois.
export const DEFAULT_PROJECT_ROUTES = [
	{ name: "claude", command: "claude --dangerously-skip-permissions" },
	{ name: "opencode", command: "opencode" },
	{ name: "codex", command: "codex --yolo" },
];
