import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { project_routes, projects } from "../db/connection";
import { resolveProjectRouteCli, resolveProjectRouteIcon } from "@/constants/projects";
import type { ProjectActionGroup, ProjectActionMode } from "@/constants/project-actions";
import { spawnCapture } from "./spawn";

export type ProjectAction = {
	id: string;
	group: ProjectActionGroup;
	label: string;
	icon: string;
	command?: string;
	cwd: string;
	mode: ProjectActionMode;
	routeId?: string;
};

const COMPOSE_FILES = ["compose.yaml", "compose.yml", "docker-compose.yml", "docker-compose.yaml"];
const LONG_RUNNING_SCRIPT = /^(dev|start|serve|watch|preview)(:|$)|(^|:)(logs|studio|ui)$/;
const LONG_RUNNING_BODY = /--watch|--hot|\blogs\s+-f\b/;
const OUTPUT_TAIL = 12_000;
const RUN_TIMEOUT_MS = 10 * 60_000;

const GIT_ACTIONS = [
	{
		id: "pull",
		label: "Atualizar branch",
		icon: "GitPullRequestArrow",
		command: "git pull --ff-only",
	},
] as const;

const DOCKER_ACTIONS = [
	{ id: "restart", label: "Reiniciar app", icon: "RotateCcw", command: "docker compose restart" },
	{ id: "up", label: "Subir containers", icon: "Play", command: "docker compose up -d" },
	{ id: "stop", label: "Parar containers", icon: "Square", command: "docker compose stop" },
	{
		id: "logs",
		label: "Logs ao vivo",
		icon: "ScrollText",
		command: "docker compose logs -f --tail 200",
		mode: "terminal",
	},
] as const;

function shellQuote(value: string) {
	if (/^[\w:.@/-]+$/.test(value)) return value;
	return `'${value.replaceAll("'", `'\\''`)}'`;
}

const RUN_SCRIPT = /\b(?:bun|npm|pnpm|yarn)\s+run\s+([\w:.-]+)/g;
const TYPED_SCRIPT = /\b(?:bun|npm|pnpm|yarn)(?:\s+run)?\s+([\w:.-]+)/g;
const ALIAS_SCRIPT = /^(?:bun|npm|pnpm|yarn)\s+run\s+([\w:.-]+)$/;
const SCRIPT_COMMAND = /^(?:bun|npm|pnpm|yarn)(?:\s+run)?\s+([\w:.-]+)$/;
const EVERYDAY_SCRIPT =
	/^(?:dev|start|build|deploy|release|setup|seed|generate)$|^(?:dev|db|deploy|install):/;
const VERIFY_SCRIPT =
	/(?:^|:)(?:test|check|conferir|lint|oxlint|eslint|typecheck|tc|format|fmt|knip|dead-code|bench|e2e|smoke)(?:$|:)/;
const HISTORY_TAIL_BYTES = 1_000_000;
const LIFECYCLE_SCRIPT =
	/^(?:(?:pre|post)?(?:install|prepare|publish|pack|version)|prepublishOnly)$/;
const NOISE_SCRIPT = /(?:^|:)(?:watch|clean)(?:$|:)/;
const FOREIGN_PLATFORM_TOKENS: Record<string, string[]> = {
	linux: ["mac", "macos", "darwin", "osx", "dmg", "win", "windows", "win32", "nsis", "exe"],
	darwin: ["linux", "appimage", "deb", "rpm", "win", "windows", "win32", "nsis", "exe"],
	win32: ["mac", "macos", "darwin", "osx", "dmg", "linux", "appimage", "deb", "rpm"],
};

type ScriptContext = { typed?: Set<string>; covered?: Set<string>; platform?: string };

export function scriptCalls(text: string) {
	return new Set([...text.matchAll(TYPED_SCRIPT)].flatMap((match) => match[1] ?? []));
}

async function readTypedScripts() {
	const home = homedir();
	const files = [
		join(process.env.XDG_DATA_HOME ?? join(home, ".local/share"), "fish/fish_history"),
		join(home, ".zsh_history"),
		join(home, ".bash_history"),
	];
	const texts = await Promise.all(
		files.map(async (path) => {
			const file = Bun.file(path);
			return (await file.exists()) ? file.slice(-HISTORY_TAIL_BYTES).text() : "";
		}),
	);
	return scriptCalls(texts.join("\n"));
}

export function pickUsefulScripts(
	scripts: Record<string, string>,
	{ typed = new Set(), covered = new Set(), platform = process.platform }: ScriptContext = {},
) {
	const names = Object.keys(scripts);
	const aliasOf = (name: string) => {
		const target = scripts[name]?.trim().match(ALIAS_SCRIPT)?.[1];
		return target && target !== name && target in scripts ? target : undefined;
	};
	const resolve = (name: string, depth = 0): string => {
		const target = aliasOf(name);
		return target && depth < names.length ? resolve(target, depth + 1) : name;
	};
	const rank = (name: string) => [name.split(":").length, aliasOf(name) ? 1 : 0];
	const better = (a: string, b: string) => {
		const [ra, rb] = [rank(a), rank(b)];
		const diff = ra.findIndex((value, index) => value !== rb[index]);
		return diff !== -1 && (ra[diff] ?? 0) < (rb[diff] ?? 0);
	};

	const kept = new Map<string, string>();
	for (const name of names) {
		const key = scripts[resolve(name)]?.trim() ?? "";
		const current = kept.get(key);
		if (!current || better(name, current)) kept.set(key, name);
	}
	const unique = names.filter((name) => kept.get(scripts[resolve(name)]?.trim() ?? "") === name);

	const called = new Set(
		unique.flatMap((name) =>
			[...(scripts[resolve(name)] ?? "").matchAll(RUN_SCRIPT)]
				.map((match) => match[1])
				.filter((target) => target !== name),
		),
	);
	const foreign = new Set(FOREIGN_PLATFORM_TOKENS[platform] ?? []);

	return unique.filter(
		(name) =>
			!covered.has(name) &&
			!LIFECYCLE_SCRIPT.test(name) &&
			!(name.replace(/^(?:pre|post)/, "") in scripts && /^(?:pre|post)./.test(name)) &&
			!NOISE_SCRIPT.test(name) &&
			!VERIFY_SCRIPT.test(name) &&
			!(name.includes(":") && called.has(name)) &&
			!name.split(/[:_-]/).some((token) => foreign.has(token.toLowerCase())) &&
			(EVERYDAY_SCRIPT.test(name) || typed.has(name)),
	);
}

async function readScripts(cwd: string, context: ScriptContext) {
	const file = Bun.file(join(cwd, "package.json"));
	if (!(await file.exists())) {
		return [];
	}
	try {
		const pkg = (await file.json()) as { scripts?: Record<string, unknown> };
		const scripts = Object.fromEntries(
			Object.entries(pkg.scripts ?? {}).filter(
				(entry): entry is [string, string] => typeof entry[1] === "string",
			),
		);
		return pickUsefulScripts(scripts, context).map((name) => ({ name, body: scripts[name] ?? "" }));
	} catch {
		return [];
	}
}

function routeAction(route: project_routes): ProjectAction {
	const cli = resolveProjectRouteCli(route);
	return {
		id: `route:${route.id}`,
		group: cli ? "cli" : "comando",
		label: route.name,
		icon: resolveProjectRouteIcon(route),
		command: route.command ?? undefined,
		cwd: route.route,
		mode: !cli && route.command && route.background ? "background" : "terminal",
		routeId: route.id,
	};
}

export async function listProjectActions(
	project: Pick<projects, "main_route">,
	routes: project_routes[],
): Promise<ProjectAction[]> {
	const cwd = project.main_route;
	const hasGit = existsSync(join(cwd, ".git"));
	const hasCompose = COMPOSE_FILES.some((name) => existsSync(join(cwd, name)));
	const covered = new Set(
		routes.flatMap((route) => route.command?.trim().match(SCRIPT_COMMAND)?.[1] ?? []),
	);
	const scripts = await readScripts(cwd, { typed: await readTypedScripts(), covered });

	return [
		...routes.map(routeAction),
		...(hasCompose
			? DOCKER_ACTIONS.map((action) => ({
					id: `docker:${action.id}`,
					group: "docker" as const,
					label: action.label,
					icon: action.icon,
					command: action.command,
					cwd,
					mode: "mode" in action ? action.mode : ("background" as const),
				}))
			: []),
		...(hasGit
			? GIT_ACTIONS.map((action) => ({
					id: `git:${action.id}`,
					group: "git" as const,
					label: action.label,
					icon: action.icon,
					command: action.command,
					cwd,
					mode: "background" as const,
				}))
			: []),
		...scripts.map(({ name, body }) => ({
			id: `script:${name}`,
			group: "script" as const,
			label: name,
			icon: "SquareCode",
			command: `bun run ${shellQuote(name)}`,
			cwd,
			mode:
				LONG_RUNNING_SCRIPT.test(name) || LONG_RUNNING_BODY.test(body)
					? ("terminal" as const)
					: ("background" as const),
		})),
	];
}

export async function readGitSummary(cwd: string) {
	if (!existsSync(join(cwd, ".git"))) {
		return null;
	}
	const result = await spawnCapture({
		cmd: ["git", "status", "--porcelain=v2", "--branch"],
		cwd,
		timeoutMs: 5_000,
	}).catch(() => null);
	if (!result || result.exitCode !== 0) {
		return null;
	}
	return parseGitStatus(result.stdout);
}

export function parseGitStatus(output: string) {
	const lines = output.split("\n").filter(Boolean);
	const header = (key: string) =>
		lines.find((line) => line.startsWith(`# branch.${key} `))?.slice(`# branch.${key} `.length);
	const [ahead, behind] = (header("ab") ?? "+0 -0")
		.split(" ")
		.map((value) => Math.abs(Number.parseInt(value, 10)) || 0);

	return {
		branch: header("head") ?? "?",
		changes: lines.filter((line) => !line.startsWith("#")).length,
		ahead: ahead ?? 0,
		behind: behind ?? 0,
		hasUpstream: header("upstream") !== undefined,
	};
}

export async function runActionInBackground(action: ProjectAction) {
	if (!action.command) {
		throw new Error("Esta ação não tem comando para rodar em background");
	}
	const startedAt = Date.now();
	const result = await spawnCapture({
		cmd: ["bash", "-lc", action.command],
		cwd: action.cwd,
		timeoutMs: RUN_TIMEOUT_MS,
	});
	const output = Bun.stripANSI(
		[result.stdout, result.stderr].filter((part) => part.trim()).join("\n"),
	);

	return {
		ok: result.exitCode === 0 && !result.timedOut,
		exitCode: result.exitCode,
		timedOut: result.timedOut,
		durationMs: Date.now() - startedAt,
		output: output.length > OUTPUT_TAIL ? `…${output.slice(-OUTPUT_TAIL)}` : output,
	};
}
