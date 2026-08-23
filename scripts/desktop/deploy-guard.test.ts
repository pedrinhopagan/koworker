import { describe, expect, test } from "bun:test";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

// Regressão do incidente: um deploy encerrava kw-terminal e todos os agents das panes. Duas causas
// estavam no código: filho direto herdando o cgroup do serviço (morria no restart) e pkill com
// padrão largo. Este teste trava a política:
//
// 1. Nada em scripts/desktop usa pkill/killall — morte de processo é por PID, com padrão ancorado.
// 2. systemctl restart/stop só nas unidades da lista abaixo; qualquer outra é ciclo de vida alheio.
// 3. Em src/api, pkill/killall só na limpeza documentada de órfãos do agent-browser (stray.ts).

const SCRIPTS_DIR = "scripts/desktop";
const API_HELPERS_DIR = join("src", "api", "helpers");

const ALLOWED_SYSTEMD_UNITS = new Set([
	"kowork-backend.service",
	"kowork-redeploy",
	"kw-terminal-server",
]);

const BROAD_KILL_PATTERN = /\bpkill\b|\bkillall\b/;

async function listFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await listFiles(fullPath)));
			continue;
		}
		if (/\.(ts|sh)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
			files.push(fullPath);
		}
	}

	return files;
}

async function fileExists(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isFile();
	} catch {
		return false;
	}
}

// Comentários citam a política por extenso; só código executável conta.
function stripComments(content: string, isShell: boolean): string {
	const withoutBlocks = content.replaceAll(/\/\*[\s\S]*?\*\//g, "");

	return isShell
		? withoutBlocks.replaceAll(/(^|\s)#.*$/gm, "$1")
		: withoutBlocks.replaceAll(/(^|\s)\/\/.*$/gm, "$1");
}

describe("política de isolamento de processos", () => {
	test("scripts de build/deploy não usam pkill nem killall", async () => {
		expect(await listFiles(SCRIPTS_DIR)).not.toHaveLength(0);

		const offenders: string[] = [];
		for (const file of await listFiles(SCRIPTS_DIR)) {
			const code = stripComments(await readFile(file, "utf8"), file.endsWith(".sh"));
			if (BROAD_KILL_PATTERN.test(code)) {
				offenders.push(file);
			}
		}

		expect(offenders).toEqual([]);
	});

	test("scripts de deploy só reiniciam unidades systemd permitidas", async () => {
		const offenders: string[] = [];

		for (const file of await listFiles(SCRIPTS_DIR)) {
			const content = await readFile(file, "utf8");
			const code = stripComments(content, file.endsWith(".sh"));

			const consts = new Map<string, string>();
			for (const [, name, value] of content.matchAll(
				/(?:const|var|let)\s+(\w+)\s*=\s*"([^"]+)"/g,
			)) {
				consts.set(name, value);
			}

			for (const [, token] of code.matchAll(
				/systemctl["',\s]+--user["',\s]+(?:restart|stop)["',\s]+([\w.@\\-]+)/g,
			)) {
				const unit = consts.get(token) ?? token;
				if (!ALLOWED_SYSTEMD_UNITS.has(unit.trim())) {
					offenders.push(`${file}: ${unit.trim()}`);
				}
			}
		}

		expect(offenders).toEqual([]);
	});

	test("código da API não mata processos por padrão largo, exceto órfãos do agent-browser", async () => {
		const offenders: string[] = [];

		for (const file of await listFiles(API_HELPERS_DIR)) {
			if (file.endsWith("stray.ts")) {
				continue;
			}

			if (BROAD_KILL_PATTERN.test(stripComments(await readFile(file, "utf8"), false))) {
				offenders.push(file);
			}
		}

		expect(offenders).toEqual([]);
	});

	test("kw-terminal server não nasce mais como filho direto do backend", async () => {
		const sourcePath = join("src", "api", "helpers", "terminal", "kw-terminal.ts");
		expect(await fileExists(sourcePath)).toBe(true);
		const source = await readFile(sourcePath, "utf8");

		expect(source).toContain("spawnDetachedFromService");
		expect(/Bun\.spawn\(\s*\[\s*"kw-terminal",\s*"server"/.test(source)).toBe(false);
	});
});
