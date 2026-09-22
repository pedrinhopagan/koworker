import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { detectShellAgent } from "./agent-detect";

async function fakeProc(root: string, pid: number, ppid: number, cmdline: string[]) {
	const dir = join(root, String(pid));
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, "stat"), `${pid} (proc-${pid}) S ${ppid} 1 1 34816 1`);
	await writeFile(join(dir, "cmdline"), `${cmdline.join("\0")}\0`);
}

async function withProcTree(fn: (root: string) => Promise<void>) {
	const root = join(tmpdir(), `kw-proc-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	await mkdir(root);

	try {
		await fn(root);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

describe("detectShellAgent", () => {
	test("binário nativo do agent é reconhecido pelo argv[0]", async () => {
		await withProcTree(async (root) => {
			await fakeProc(root, 100, 1, ["bash", "--norc"]);
			await fakeProc(root, 101, 100, ["opencode"]);

			expect(await detectShellAgent(100, root)).toBe("opencode");
		});
	});

	test("CLI rodando como script de node é reconhecida pelo argv[1]", async () => {
		await withProcTree(async (root) => {
			await fakeProc(root, 200, 1, ["bash", "--norc"]);
			await fakeProc(root, 201, 200, ["node", "/usr/local/bin/claude", "--continue"]);

			expect(await detectShellAgent(200, root)).toBe("claude");
		});
	});

	test("exec substitui o shell: o próprio pid raiz pode ser o agent", async () => {
		await withProcTree(async (root) => {
			await fakeProc(root, 250, 1, ["opencode"]);

			expect(await detectShellAgent(250, root)).toBe("opencode");
		});
	});

	test("em cadeia aninhada o match mais fundo vence", async () => {
		await withProcTree(async (root) => {
			await fakeProc(root, 300, 1, ["bash", "--norc"]);
			await fakeProc(root, 301, 300, ["sh", "-c", "wrangler dev"]);
			await fakeProc(root, 302, 301, ["codex"]);

			expect(await detectShellAgent(300, root)).toBe("codex");
		});
	});

	test("programa qualquer não vira agent", async () => {
		await withProcTree(async (root) => {
			await fakeProc(root, 400, 1, ["bash", "--norc"]);
			await fakeProc(root, 401, 400, ["nvim", "claude.md"]);
			await fakeProc(root, 402, 400, ["htop"]);

			expect(await detectShellAgent(400, root)).toBeNull();
		});
	});

	test("árvore inexistente devolve nulo", async () => {
		await withProcTree(async (root) => {
			expect(await detectShellAgent(999, root)).toBeNull();
		});
	});
});

test("ignora agente em background quando o shell tem o primeiro plano", async () => {
	await withProcTree(async (root) => {
		await fakeProc(root, 100, 1, ["bash"]);
		await fakeProc(root, 101, 100, ["codex"]);
		await writeFile(join(root, "101/stat"), "101 (codex) S 100 101 100 34816 100");

		expect(await detectShellAgent(100, root)).toBeNull();
	});
});

test("agente em primeiro plano prevalece sobre processos de ferramentas", async () => {
	await withProcTree(async (root) => {
		await fakeProc(root, 100, 1, ["bash"]);
		await fakeProc(root, 101, 100, ["codex"]);
		await fakeProc(root, 102, 101, ["claude"]);
		await writeFile(join(root, "101/stat"), "101 (codex) S 100 101 100 34816 101");
		await writeFile(join(root, "102/stat"), "102 (claude) S 101 102 100 34816 101");

		expect(await detectShellAgent(100, root)).toBe("codex");
	});
});

test("wrapper pessoal é reconhecido", async () => {
	await withProcTree(async (root) => {
		await fakeProc(root, 100, 1, ["bash"]);
		await fakeProc(root, 101, 100, ["bash", "/home/user/.local/bin/codex-personal"]);

		expect(await detectShellAgent(100, root)).toBe("codex");
	});
});

test("argumento com nome de agente e execução não interativa não abrem chat", async () => {
	await withProcTree(async (root) => {
		await fakeProc(root, 100, 1, ["bash"]);
		await fakeProc(root, 101, 100, ["cat", "/tmp/claude"]);
		await fakeProc(root, 102, 100, ["codex", "exec", "teste"]);
		await fakeProc(root, 103, 100, ["claude", "--print", "teste"]);

		expect(await detectShellAgent(100, root)).toBeNull();
	});
});
