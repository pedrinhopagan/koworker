import { describe, expect, test } from "bun:test";

import { fileViewerHref, linkLine, looksLikeFilePath, opensFilesInApp } from "./link-paths";

describe("looksLikeFilePath", () => {
	test("aceita caminhos e nomes de arquivo citados", () => {
		for (const text of [
			"src/api/routers/system.ts:86",
			"./README.md",
			"../a/b.py",
			"/abs/path/to/file",
			"package.json",
			"AGENTS.md",
			"docs/TERMINAL.md:12:4",
			"~/.claude/settings.json",
		]) {
			expect(looksLikeFilePath(text)).toBe(true);
		}
	});

	test("recusa identificadores, chamadas e frases", () => {
		for (const text of [
			"useAgentRadar()",
			"agent_sessions.task_id",
			"KOWORK_REMOTE_REDEPLOY=1",
			"npm run build",
			"foo.bar",
			"2026.09",
			"src/",
			".",
			"https://example.com/a.md",
		]) {
			expect(looksLikeFilePath(text)).toBe(false);
		}
	});
});

describe("linkLine", () => {
	test("extrai a linha citada e ignora coluna e pontuação", () => {
		expect(linkLine("src/a.ts:42")).toBe(42);
		expect(linkLine("src/a.ts:42:7")).toBe(42);
		expect(linkLine("(src/a.ts:42).")).toBe(42);
		expect(linkLine("src/a.ts")).toBeNull();
	});
});

describe("fileViewerHref", () => {
	test("monta a rota do leitor com caminho e linha", () => {
		expect(fileViewerHref("/tmp/a b.ts", 3)).toBe("/arquivo?path=%2Ftmp%2Fa+b.ts&line=3");
		expect(fileViewerHref("/tmp/a.ts", null)).toBe("/arquivo?path=%2Ftmp%2Fa.ts");
	});
});

describe("opensFilesInApp", () => {
	test("abre no app fora da máquina do backend", () => {
		expect(opensFilesInApp("kw.paganagency.dedyn.io", false)).toBe(true);
		expect(opensFilesInApp("100.64.0.2", false)).toBe(true);
	});

	test("mantém o app padrão do SO em loopback e no Electron", () => {
		expect(opensFilesInApp("localhost", false)).toBe(false);
		expect(opensFilesInApp("127.0.0.1", false)).toBe(false);
		expect(opensFilesInApp("kw.paganagency.dedyn.io", true)).toBe(false);
	});
});
