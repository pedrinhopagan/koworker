import { readdir, readFile, readlink } from "node:fs/promises";
import { basename, join } from "node:path";

// Mesmos slugs do radar (constants/agent-radar.ts): o item herda o rótulo e o ícone do card de
// conversa sem tradução extra.
const AGENT_PROCESS_NAMES = new Set([
	"claude",
	"codex",
	"codex-personal",
	"opencode",
	"opencode2",
	"gemini",
	"pi",
]);

async function processAgentSlug(pid: number, procRoot: string): Promise<string | null> {
	const raw = await readFile(join(procRoot, String(pid), "cmdline"), "utf8").catch(() => null);
	if (raw === null) {
		return null;
	}

	// argv[0] cobre binário nativo; argv[1] cobre `node /usr/local/bin/claude`, em que o nome do
	// agent é o caminho do script e não o interpretador.
	const args = raw.split("\0").filter(Boolean);
	const executable = basename(args[0] ?? "").replace(/\.exe$/, "");
	const interpreter = ["node", "bun", "bash", "sh", "dash", "zsh", "fish"].includes(executable);
	for (const arg of args.slice(0, interpreter ? 2 : 1)) {
		// O opencode é distribuído como binário empacotado e chega com `.exe` no nome mesmo no Linux.
		const name = basename(arg).replace(/\.exe$/, "");
		if (AGENT_PROCESS_NAMES.has(name)) {
			if (
				(name.startsWith("codex") && args.includes("exec")) ||
				(name === "claude" && (args.includes("-p") || args.includes("--print")))
			) {
				return null;
			}
			return name;
		}
	}

	return null;
}

async function childrenMap(procRoot: string): Promise<Map<number, number[]>> {
	const entries = await readdir(procRoot).catch(() => []);
	const parents = new Map<number, number>();

	for (const entry of entries) {
		const pid = Number(entry);
		if (!Number.isInteger(pid) || pid <= 0) {
			continue;
		}

		const stat = await readFile(join(procRoot, entry, "stat"), "utf8").catch(() => null);
		if (!stat) {
			continue;
		}

		// `pid (comm) state ppid ...`: comm pode conter espaço e parêntese, então o corte é no
		// último ')' e o ppid é o segundo campo depois dele.
		const fields = stat
			.slice(stat.lastIndexOf(")") + 1)
			.trim()
			.split(/\s+/);
		const ppid = Number(fields[1]);
		if (Number.isInteger(ppid)) {
			parents.set(pid, ppid);
		}
	}

	const children = new Map<number, number[]>();
	for (const [pid, ppid] of parents) {
		const known = children.get(ppid);
		if (known) {
			known.push(pid);
		} else {
			children.set(ppid, [pid]);
		}
	}

	return children;
}

export async function inspectShellAgent(pid: number, procRoot = "/proc") {
	const children = await childrenMap(procRoot);
	const queue = [pid];
	const visited = new Set<number>();
	const matches: { agent: string; pid: number }[] = [];

	while (queue.length > 0) {
		const current = queue.shift()!;
		if (visited.has(current)) {
			continue;
		}
		visited.add(current);

		const stat = await readFile(join(procRoot, String(current), "stat"), "utf8").catch(() => null);
		const fields = stat
			?.slice(stat.lastIndexOf(")") + 1)
			.trim()
			.split(/\s+/);
		const foreground = Number(fields?.[5]);
		const group = Number(fields?.[2]);
		const agent = await processAgentSlug(current, procRoot);
		if (agent && foreground > 0 && group === foreground) {
			matches.push({ agent: agent === "codex-personal" ? "codex" : agent, pid: current });
		}

		queue.push(...(children.get(current) ?? []));
	}

	const first = matches[0];
	if (!first) {
		return null;
	}

	return {
		...first,
		cwd: await readlink(join(procRoot, String(first.pid), "cwd")).catch(() => null),
		processIds: matches.filter((match) => match.agent === first.agent).map((match) => match.pid),
	};
}

export async function detectShellAgent(pid: number, procRoot = "/proc"): Promise<string | null> {
	return (await inspectShellAgent(pid, procRoot))?.agent ?? null;
}
