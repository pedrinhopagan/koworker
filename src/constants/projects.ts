const PROJECT_CLI_ICONS = {
	claude: "Bot",
	codex: "SquareTerminal",
	opencode: "CodeXml",
	pi: "SquareTerminal",
} as const;

export const PROJECT_DOC_NAMES = [
	"AGENTS.md",
	"CLAUDE.md",
	"GEMINI.md",
	"CODEX.md",
	"CURSOR.md",
	"README.md",
	"CONTRIBUTING.md",
	"ARCHITECTURE.md",
	"DEVELOPMENT.md",
	"INSTALL.md",
	"DEPLOYMENT.md",
	"SECURITY.md",
	"CODE_OF_CONDUCT.md",
	"CHANGELOG.md",
	"ROADMAP.md",
	"TROUBLESHOOTING.md",
	"LICENSE.md",
	"TODO.md",
] as const;

const PROJECT_DOC_ICONS: Record<(typeof PROJECT_DOC_NAMES)[number], string> = {
	"AGENTS.md": "Bot",
	"CLAUDE.md": "Sparkles",
	"GEMINI.md": "Gem",
	"CODEX.md": "SquareTerminal",
	"CURSOR.md": "MousePointer2",
	"README.md": "BookOpenText",
	"CONTRIBUTING.md": "GitPullRequestArrow",
	"ARCHITECTURE.md": "Network",
	"DEVELOPMENT.md": "Code2",
	"INSTALL.md": "PackagePlus",
	"DEPLOYMENT.md": "Rocket",
	"SECURITY.md": "ShieldCheck",
	"CODE_OF_CONDUCT.md": "HeartHandshake",
	"CHANGELOG.md": "History",
	"ROADMAP.md": "Map",
	"TROUBLESHOOTING.md": "LifeBuoy",
	"LICENSE.md": "Scale",
	"TODO.md": "ListTodo",
};

export const DEFAULT_PROJECT_ROUTES = [
	{
		name: "claude",
		command: "claude --dangerously-skip-permissions",
		icon: PROJECT_CLI_ICONS.claude,
	},
	{ name: "opencode", command: "opencode", icon: PROJECT_CLI_ICONS.opencode },
	{ name: "codex", command: "codex --yolo", icon: PROJECT_CLI_ICONS.codex },
	{ name: "pi", command: "pi", icon: PROJECT_CLI_ICONS.pi },
] as const;

type ProjectRouteIntent = {
	name: string;
	command?: string | null;
	icon?: string | null;
};

export function resolveProjectRouteCli(route: Pick<ProjectRouteIntent, "name">) {
	const name = route.name.toLocaleLowerCase().replaceAll("_", "-");
	return Object.keys(PROJECT_CLI_ICONS).find((cli) => name === cli || name.startsWith(`${cli}-`)) as
		| keyof typeof PROJECT_CLI_ICONS
		| undefined;
}

export function isProjectCliRoute(route: ProjectRouteIntent) {
	return resolveProjectRouteCli(route) !== undefined;
}

export function resolveProjectRouteIcon(route: ProjectRouteIntent) {
	const cli = resolveProjectRouteCli(route);
	if (cli) {
		return PROJECT_CLI_ICONS[cli];
	}

	const intent = `${route.name} ${route.command ?? ""}`.toLocaleLowerCase();

	if (/\b(commit|commitar)\b/.test(intent)) {
		return "GitCommitHorizontal";
	}
	if (/\b(docker|container)\b/.test(intent)) {
		return "Container";
	}
	if (/\b(mem[oó]ria|memo)\b/.test(intent)) {
		return "Brain";
	}
	if (/\b(reiniciar|restart)\b/.test(intent)) {
		return "RotateCcw";
	}
	if (/\b(parar|stop)\b/.test(intent)) {
		return "CircleStop";
	}
	if (/\b(status|estado)\b/.test(intent)) {
		return "Activity";
	}
	if (/\b(jogo|game)\b/.test(intent)) {
		return "Gamepad2";
	}
	if (/\b(deploy|publicar|release)\b/.test(intent)) {
		return "Rocket";
	}
	if (/\b(build|compilar)\b/.test(intent)) {
		return "Hammer";
	}
	if (/\b(test|teste|vitest|jest)\b/.test(intent)) {
		return "FlaskConical";
	}
	if (/\b(lint|oxlint|eslint|check|verificar)\b/.test(intent)) {
		return "ScanSearch";
	}
	if (/\b(format|formatar|prettier)\b/.test(intent)) {
		return "WandSparkles";
	}
	if (/\b(install|instalar|setup)\b/.test(intent)) {
		return "PackagePlus";
	}
	if (/\b(update|atualizar|upgrade)\b/.test(intent)) {
		return "RefreshCw";
	}
	if (/\b(backup|restaurar|restore)\b/.test(intent)) {
		return "ArchiveRestore";
	}
	if (/\b(migra|database|banco|db)\b/.test(intent)) {
		return "Database";
	}
	if (/\b(log|logs)\b/.test(intent)) {
		return "ScrollText";
	}
	if (/\b(clean|limpar|reset)\b/.test(intent)) {
		return "Trash2";
	}
	if (/\b(diff|comparar)\b/.test(intent)) {
		return "Diff";
	}
	if (/\b(dev|serve|server|front|api|app)\b/.test(intent)) {
		return "MonitorPlay";
	}

	if (route.icon && !["Cpu", "FolderOpen", "play"].includes(route.icon)) {
		return route.icon;
	}
	return route.command ? "TerminalSquare" : "FolderOpen";
}

export function resolveProjectDocIcon(name: string) {
	const canonicalName = PROJECT_DOC_NAMES.find(
		(docName) => docName.toLocaleUpperCase() === name.toLocaleUpperCase(),
	);

	return canonicalName ? PROJECT_DOC_ICONS[canonicalName] : "FileText";
}
