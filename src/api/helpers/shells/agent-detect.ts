import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

// Mesmos slugs do radar (constants/agent-radar.ts): o item herda o rótulo e o ícone do card de
// conversa sem tradução extra.
const AGENT_PROCESS_NAMES = new Set(["claude", "codex", "opencode", "gemini", "pi"]);

async function processAgentSlug(pid: number, procRoot: string): Promise<string | null> {
	const raw = await readFile(join(procRoot, String(pid), "cmdline"), "utf8").catch(() => null);
	if (raw === null) {
		return null;
	}

	// argv[0] cobre binário nativo; argv[1] cobre `node /usr/local/bin/claude`, em que o nome do
	// agent é o caminho do script e não o interpretador.
	const args = raw.split("\0").filter(Boolean);
	for (const arg of args.slice(0, 2)) {
		const name = basename(arg);
		if (AGENT_PROCESS_NAMES.has(name)) {
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

// Agent de AI rodando dentro do shell: caminha a árvore de processos abaixo do líder da sessão e
// devolve o slug da CLI reconhecida. O próprio processo raiz entra na conta — `exec opencode`
// substitui o shell em vez de criar filho. Em cadeia aninhada, o match mais fundo (ordem BFS)
// vence — é quem está de fato na tela.
export async function detectShellAgent(pid: number, procRoot = "/proc"): Promise<string | null> {
	const children = await childrenMap(procRoot);
	const queue = [pid, ...(children.get(pid) ?? [])];
	let found: string | null = null;

	while (queue.length > 0) {
		const current = queue.shift();
		if (current === undefined) {
			continue;
		}

		const slug = await processAgentSlug(current, procRoot);
		if (slug) {
			found = slug;
		}

		queue.push(...(children.get(current) ?? []));
	}

	return found;
}
