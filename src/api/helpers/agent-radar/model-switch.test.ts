import { afterEach, expect, mock, spyOn, test } from "bun:test";

import type { RadarAgent } from "@/api/schemas/terminal-workspace";
process.env.NODE_ENV = "development";

const panes = await import("../terminal/kw-terminal");
const { Terminal } = await import("../terminal/service");
const { switchPaneModel } = await import("./model-switch");
const radar = await import("./state");
const config = await import("./model-configure");
const sync = await import("./transcript/sync");

afterEach(() => mock.restore());

function setup() {
	const agent: RadarAgent = {
		paneId: "old",
		workspaceId: "workspace",
		workspaceLabel: "Projeto",
		tabId: "tab",
		tabLabel: "sess_Conversa",
		agent: "codex",
		status: "idle",
		activity: null,
		title: null,
		cwd: "/tmp/chat",
		projectId: null,
		projectName: null,
		sessionId: null,
		sessionPath: null,
		taskId: null,
		taskTitle: null,
		changedAt: 0,
	};
	const next = { ...agent, paneId: "new", sessionId: "new-session" };
	spyOn(sync, "syncPaneTranscriptSource").mockResolvedValue(null);
	spyOn(radar, "getRadarAgent").mockImplementation((id) => (id === "old" ? agent : next));
	spyOn(Bun, "sleep").mockImplementation(() => Promise.resolve());
	const start = spyOn(Terminal, "startSession").mockResolvedValue({
		paneId: "new",
		tabId: "new-tab",
		workspaceId: "workspace",
	});
	const resume = spyOn(Terminal, "resumeSessionById").mockResolvedValue({
		paneId: "new",
		tabId: "new-tab",
		workspaceId: "workspace",
	});
	const configure = spyOn(config, "configurePaneModel").mockResolvedValue({
		model: "modelo",
		effort: "high",
	});
	const close = spyOn(panes, "kwTerminalPaneClose").mockResolvedValue(true);
	const send = spyOn(panes, "kwTerminalPaneRun").mockImplementation(() => {
		next.status = "working";
		return Promise.resolve();
	});

	return { agent, start, resume, close, send, configure };
}

test.each(["codex", "claude"] as const)(
	"troca %s no mesmo pane, sem exigir ID de sessão ou primeira mensagem",
	async (cli) => {
		const { agent, start, resume, close, send, configure } = setup();
		agent.agent = cli;
		const text = "Primeiro parágrafo\n\nSegundo parágrafo";
		const result = await switchPaneModel({
			paneId: "old",
			cli,
			model: "modelo",
			effort: "high",
			text,
		});
		expect(result).toEqual({ kind: "updated", paneId: "old" });
		expect(configure).toHaveBeenCalledWith({ paneId: "old", cli, model: "modelo", effort: "high" });
		expect(start).not.toHaveBeenCalled();
		expect(resume).not.toHaveBeenCalled();
		expect(close).not.toHaveBeenCalled();
		expect(send).toHaveBeenCalledWith("old", text);
	},
);

test("falha na configuração mantém a conversa e não envia a mensagem", async () => {
	const { configure, close, send } = setup();
	configure.mockRejectedValue(new Error("Modelo indisponível"));
	await expect(
		switchPaneModel({ paneId: "old", cli: "codex", model: "modelo", text: "Olá" }),
	).rejects.toThrow("Modelo indisponível");
	expect(close).not.toHaveBeenCalled();
	expect(send).not.toHaveBeenCalled();
});

test("troca durante um turno não reinicia nem interrompe o processo", async () => {
	const { agent, resume, close, configure } = setup();
	agent.sessionId = "existing-session";
	agent.status = "working";
	await switchPaneModel({ paneId: "old", cli: "codex", model: "modelo", text: "Olá" });
	expect(configure).toHaveBeenCalled();
	expect(resume).not.toHaveBeenCalled();
	expect(close).not.toHaveBeenCalled();
});

test("migração de CLI sem conversa abre sessão e só então fecha a anterior", async () => {
	const { start, close, send } = setup();
	const result = await switchPaneModel({
		paneId: "old",
		cli: "claude",
		model: "modelo",
		text: "Olá",
	});
	expect(result).toEqual({ kind: "moved", paneId: "new" });
	expect(start).toHaveBeenCalled();
	expect(send).toHaveBeenCalledWith("new", "Olá");
	expect(close).toHaveBeenCalledWith("old");
});
