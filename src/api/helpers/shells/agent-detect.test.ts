import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { detectShellAgent } from "./agent-detect";

async function fakeProc(root: string, pid: number, ppid: number, cmdline: string[]) {
	const dir = join(root, String(pid));
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, "stat"), `${pid} (proc-${pid}) S ${ppid} 1 1 0`);
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
