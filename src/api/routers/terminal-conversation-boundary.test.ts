import { expect, test } from "bun:test";

const modules = [
	"src/api/routers/kw-terminal.ts",
	"src/api/routers/agent-radar.ts",
	"src/api/helpers/terminal/cli-argv.ts",
];

test("conversas do terminal não dependem dos writers legados", async () => {
	for (const path of modules) {
		const source = await Bun.file(path).text();

		expect(source).not.toContain("dbAgentSessions");
		expect(source).not.toContain("dbAgentEvents");
		expect(source).not.toContain("dbExecutionRuns");
		expect(source).not.toContain("agent_sessions");
		expect(source).not.toContain("agent_events");
		expect(source).not.toContain("execution_runs");
	}
});

test("envia continuação durante o trabalho do agent sem interromper", async () => {
	const router = await Bun.file("src/api/routers/agent-radar.ts").text();
	const page = await Bun.file("src/routes/_app/terminals/$paneId/index.lazy.tsx").text();

	expect(router).toContain("await kwTerminalPaneRun(input.paneId, input.text)");
	expect(router).not.toContain('agent.status === "working"');
	expect(page).toContain("disabled={closed}");
	expect(page).not.toContain("disabled={closed || !!busy}");
});
