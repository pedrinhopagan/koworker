import { afterEach, expect, mock, spyOn, test } from "bun:test";

import type { RadarAgent } from "@/api/schemas/terminal-workspace";
process.env.NODE_ENV = "development";

const panes = await import("../terminal/kw-terminal");
const { Terminal } = await import("../terminal/service");
const { switchPaneModel } = await import("./model-switch");
const radar = await import("./state");
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
	const close = spyOn(panes, "kwTerminalPaneClose").mockResolvedValue(true);
	const send = spyOn(panes, "kwTerminalPaneRun").mockImplementation(() => {
		next.status = "working";
		return Promise.resolve();
	});

	return { agent, start, resume, close, send };
}

test.each(["codex", "claude"] as const)(
	"primeira mensagem com configuração %s abre sessão sem retomar nem compactar",
	async (cli) => {
		const { start, resume, close, send } = setup();
		const text = "Primeiro parágrafo\n\nSegundo parágrafo";
		const result = await switchPaneModel({
			paneId: "old",
			cli,
			model: "modelo",
			effort: "high",
			text,
		});

		expect(result).toEqual({ kind: "moved", paneId: "new" });
		expect(start).toHaveBeenCalledWith(
			expect.objectContaining({ cli, cwd: "/tmp/chat", model: "modelo", effort: "high" }),
		);
		expect(resume).not.toHaveBeenCalled();
		expect(send).toHaveBeenCalledWith("new", text);
		expect(close).toHaveBeenCalledWith("old");
	},
);

test("falha ao abrir a sessão preserva o pane original e não envia a mensagem", async () => {
	const { start, close, send } = setup();
	start.mockRejectedValue(new Error("Falha ao abrir"));

	await expect(
		switchPaneModel({ paneId: "old", cli: "codex", model: "modelo", text: "Olá" }),
	).rejects.toThrow("Falha ao abrir");
	expect(close).not.toHaveBeenCalled();
	expect(send).not.toHaveBeenCalled();
});

test("conversa com ID continua pelo caminho de retomada", async () => {
	const { agent, start, resume } = setup();
	agent.sessionId = "existing-session";

	await switchPaneModel({ paneId: "old", cli: "codex", model: "modelo", text: "Olá" });

	expect(start).not.toHaveBeenCalled();
	expect(resume).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "existing-session" }));
});

test("transcript sem ID não é descartado como conversa nova", async () => {
	const { agent, start, close } = setup();
	agent.sessionPath = "/tmp/existing.jsonl";

	await expect(
		switchPaneModel({ paneId: "old", cli: "codex", model: "modelo", text: "Olá" }),
	).rejects.toThrow("O CLI ainda não informou");
	expect(start).not.toHaveBeenCalled();
	expect(close).not.toHaveBeenCalled();
});
