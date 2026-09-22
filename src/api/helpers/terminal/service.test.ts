import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { KwTerminalAgent } from "./kw-terminal";
import { selectAgentForCli } from "./service";

function agentFixture(agent: string, cwd: string): KwTerminalAgent {
	return {
		agent,
		agent_status: "idle",
		cwd,
		foreground_cwd: cwd,
		focused: false,
		pane_id: `pane-${cwd}`,
		tab_id: `tab-${cwd}`,
		terminal_id: `term-${agent}-${cwd}`,
		workspace_id: `ws-${cwd}`,
	};
}

const agents = [
	agentFixture("codex", "/proj/app"),
	agentFixture("pi", "/proj/app"),
	agentFixture("claude", "/proj/app/pacote"),
	agentFixture("claude", "/proj/app"),
	agentFixture("claude", "/proj/outro"),
];

test("escolhe o agent do cli no cwd exato do projeto", () => {
	expect(selectAgentForCli({ agents, cli: "claude", mainRoute: "/proj/app" })?.cwd).toBe(
		"/proj/app",
	);
	expect(selectAgentForCli({ agents, cli: "codex", mainRoute: "/proj/app" })?.cwd).toBe(
		"/proj/app",
	);
	expect(selectAgentForCli({ agents, cli: "pi", mainRoute: "/proj/app" })?.cwd).toBe("/proj/app");
});

test("aceita subpasta do projeto quando não há agent na raiz", () => {
	const semRaiz = agents.filter((agent) => agent.cwd !== "/proj/app");

	expect(selectAgentForCli({ agents: semRaiz, cli: "claude", mainRoute: "/proj/app" })?.cwd).toBe(
		"/proj/app/pacote",
	);
});

test("não cai para o agent de outro projeto", () => {
	expect(selectAgentForCli({ agents, cli: "claude", mainRoute: "/proj/vazio" })).toBeNull();
	expect(selectAgentForCli({ agents, cli: "codex", mainRoute: "/proj/outro" })).toBeNull();
});

test("sem projeto em foco não foca sessão nenhuma", () => {
	expect(selectAgentForCli({ agents, cli: "claude" })).toBeNull();
	expect(selectAgentForCli({ agents, cli: "codex" })).toBeNull();
});

test("reconhece o agent aberto pelo caminho real de um projeto com symlink", () => {
	const root = mkdtempSync(join(tmpdir(), "kowork-terminal-symlink-"));
	const realRoot = join(root, "dogama-app");
	const aliasRoot = join(root, "Dogama");
	mkdirSync(realRoot);
	symlinkSync(realRoot, aliasRoot);

	try {
		const agent = agentFixture("claude", realRoot);
		expect(selectAgentForCli({ agents: [agent], cli: "claude", mainRoute: aliasRoot })).toBe(agent);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
