import { afterAll, expect, test } from "bun:test";

import {
	findTabByLabel,
	findWorkspaceByLabel,
	isKwTerminalClientProcess,
	type KwTerminalPane,
	type KwTerminalTab,
	type KwTerminalWorkspace,
	kwTerminalPaneList,
	kwTerminalPaneRun,
	kwTerminalTabCreate,
	kwTerminalWorkspaceClose,
	kwTerminalWorkspaceCreate,
	parseKwTerminalResult,
} from "./kw-terminal";

// Fixtures copiadas da CLI real (kw-terminal 0.7.1). Garantem que o parse do envelope JSON extrai
// `result` com o shape que o adapter espera, sem depender do servidor kw-terminal estar rodando.
const WORKSPACE_LIST = `{"id":"cli:workspace:list","result":{"type":"workspace_list","workspaces":[{"active_tab_id":"w8:t1","agent_status":"unknown","focused":true,"label":"~","number":1,"pane_count":1,"tab_count":1,"workspace_id":"w8"}]}}`;
const TAB_LIST = `{"id":"cli:tab:list","result":{"tabs":[{"agent_status":"unknown","focused":true,"label":"1","number":1,"pane_count":1,"tab_id":"w8:t1","workspace_id":"w8"}],"type":"tab_list"}}`;
const PANE_LIST = `{"id":"cli:pane:list","result":{"panes":[{"agent_status":"unknown","cwd":"/home/pedro","focused":true,"foreground_cwd":"/home/pedro","pane_id":"w8:p1","revision":0,"tab_id":"w8:t1","terminal_id":"term_655e08f8e645a8","workspace_id":"w8"}],"type":"pane_list"}}`;
const WORKSPACE_CREATE = `{"id":"cli:workspace:create","result":{"root_pane":{"agent_status":"unknown","cwd":"/tmp","focused":false,"foreground_cwd":"/tmp","pane_id":"w9:p1","revision":0,"tab_id":"w9:t1","terminal_id":"term_655e15d6577429","workspace_id":"w9"},"tab":{"agent_status":"unknown","focused":false,"label":"1","number":1,"pane_count":1,"tab_id":"w9:t1","workspace_id":"w9"},"type":"workspace_created","workspace":{"active_tab_id":"w9:t1","agent_status":"unknown","focused":false,"label":"kw_test_slice_a","number":2,"pane_count":1,"tab_count":1,"workspace_id":"w9"}}}`;
const TAB_CREATE = `{"id":"cli:tab:create","result":{"root_pane":{"agent_status":"unknown","cwd":"/tmp","focused":false,"foreground_cwd":"/tmp","pane_id":"w9:p2","revision":0,"tab_id":"w9:t2","terminal_id":"term_655e15dc70265a","workspace_id":"w9"},"tab":{"agent_status":"unknown","focused":false,"label":"kw_test_tab","number":2,"pane_count":1,"tab_id":"w9:t2","workspace_id":"w9"},"type":"tab_created"}}`;
const TAB_RENAME = `{"id":"cli:tab:rename","result":{"tab":{"agent_status":"unknown","focused":false,"label":"kw_renamed_tab","number":1,"pane_count":1,"tab_id":"w1G:t1","workspace_id":"w1G"},"type":"tab_info"}}`;
const WORKSPACE_RENAME = `{"id":"cli:workspace:rename","result":{"type":"workspace_info","workspace":{"active_tab_id":"w1G:t1","agent_status":"unknown","focused":false,"label":"kw_renamed_ws","number":3,"pane_count":1,"tab_count":1,"workspace_id":"w1G"}}}`;
const OK = `{"id":"cli:tab:close","result":{"type":"ok"}}`;

test("parseia a lista de workspaces extraindo result", () => {
	const result = parseKwTerminalResult<{ workspaces: KwTerminalWorkspace[] }>(WORKSPACE_LIST);
	expect(result.workspaces).toHaveLength(1);
	expect(result.workspaces[0]?.workspace_id).toBe("w8");
	expect(result.workspaces[0]?.label).toBe("~");
});

test("parseia a lista de tabs", () => {
	const result = parseKwTerminalResult<{ tabs: KwTerminalTab[] }>(TAB_LIST);
	expect(result.tabs[0]?.tab_id).toBe("w8:t1");
	expect(result.tabs[0]?.workspace_id).toBe("w8");
});

test("parseia a lista de panes com terminal_id", () => {
	const result = parseKwTerminalResult<{ panes: KwTerminalPane[] }>(PANE_LIST);
	expect(result.panes[0]?.pane_id).toBe("w8:p1");
	expect(result.panes[0]?.tab_id).toBe("w8:t1");
	expect(result.panes[0]?.terminal_id).toBe("term_655e08f8e645a8");
});

test("workspace create expõe workspace + root_pane", () => {
	const result = parseKwTerminalResult<{
		workspace: KwTerminalWorkspace;
		root_pane: KwTerminalPane;
	}>(WORKSPACE_CREATE);
	expect(result.workspace.workspace_id).toBe("w9");
	expect(result.workspace.label).toBe("kw_test_slice_a");
	expect(result.root_pane.pane_id).toBe("w9:p1");
	expect(result.root_pane.tab_id).toBe("w9:t1");
});

test("tab create expõe tab + root_pane", () => {
	const result = parseKwTerminalResult<{ tab: KwTerminalTab; root_pane: KwTerminalPane }>(
		TAB_CREATE,
	);
	expect(result.tab.tab_id).toBe("w9:t2");
	expect(result.tab.label).toBe("kw_test_tab");
	expect(result.root_pane.pane_id).toBe("w9:p2");
});

test("tab rename expõe a tab renomeada", () => {
	const result = parseKwTerminalResult<{ tab: KwTerminalTab }>(TAB_RENAME);
	expect(result.tab.tab_id).toBe("w1G:t1");
	expect(result.tab.label).toBe("kw_renamed_tab");
});

test("workspace rename expõe o workspace renomeado", () => {
	const result = parseKwTerminalResult<{ workspace: KwTerminalWorkspace }>(WORKSPACE_RENAME);
	expect(result.workspace.workspace_id).toBe("w1G");
	expect(result.workspace.label).toBe("kw_renamed_ws");
});

test("close responde envelope ok", () => {
	const result = parseKwTerminalResult<{ type: string }>(OK);
	expect(result.type).toBe("ok");
});

test("reconhece o processo do cliente TUI e ignora server e subcomandos efêmeros", () => {
	expect(isKwTerminalClientProcess("kw-terminal")).toBe(true);
	expect(isKwTerminalClientProcess("kw-terminal session attach default")).toBe(true);
	expect(isKwTerminalClientProcess("kw-terminal --session work")).toBe(true);
	expect(isKwTerminalClientProcess("kw-terminal --remote host")).toBe(true);

	expect(isKwTerminalClientProcess("kw-terminal server")).toBe(false);
	expect(isKwTerminalClientProcess("kw-terminal workspace list")).toBe(false);
	expect(isKwTerminalClientProcess("kw-terminal session list")).toBe(false);
	expect(isKwTerminalClientProcess("kw-terminal tab close w9:t2")).toBe(false);
	expect(isKwTerminalClientProcess("/usr/bin/zsh -c kw-terminal")).toBe(false);
});

// Integração real: só roda com o binário kw-terminal disponível. Cria e derruba um workspace de teste.
const hasKwTerminal = !!Bun.which("kw-terminal");
const testLabel = `kw_test_slice_a_${process.pid}`;
let createdWorkspaceId: string | null = null;

afterAll(async () => {
	if (hasKwTerminal && createdWorkspaceId) {
		await kwTerminalWorkspaceClose(createdWorkspaceId);
	}
});

test.skipIf(!hasKwTerminal)("cria workspace/tab/pane e roda comando no pane", async () => {
	const workspace = await kwTerminalWorkspaceCreate({ cwd: "/tmp", label: testLabel });
	createdWorkspaceId = workspace.workspace_id;
	expect(workspace.label).toBe(testLabel);

	const found = await findWorkspaceByLabel(testLabel);
	expect(found?.workspace_id).toBe(workspace.workspace_id);

	const { tab, rootPane } = await kwTerminalTabCreate({
		workspaceId: workspace.workspace_id,
		cwd: "/tmp",
		label: "kw_test_tab",
	});
	expect(tab.workspace_id).toBe(workspace.workspace_id);

	const tabByLabel = await findTabByLabel(workspace.workspace_id, "kw_test_tab");
	expect(tabByLabel?.tab_id).toBe(tab.tab_id);

	const panes = await kwTerminalPaneList({
		workspaceId: workspace.workspace_id,
		tabId: tab.tab_id,
	});
	expect(panes.map((pane) => pane.pane_id)).toContain(rootPane.pane_id);

	await kwTerminalPaneRun(rootPane.pane_id, "echo hello_slice_a");
});
