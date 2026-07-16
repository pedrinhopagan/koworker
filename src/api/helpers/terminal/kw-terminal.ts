import { spawnEnv } from "@/api/helpers/spawn";

// Wrappers finos sobre o binário `kw-terminal`. O estado de verdade do "que está aberto" vive no
// servidor kw-terminal (um daemon independente que sobrevive ao restart do backend), então lemos dele
// ao vivo em vez de cachear. A CLI responde com um envelope JSON de uma linha
// (`{"id":"cli:...","result":{...}}`); cada wrapper roda um subcomando e extrai `result` tipado.

export type KwTerminalWorkspace = {
	workspace_id: string;
	label: string;
	number: number;
	focused: boolean;
	active_tab_id: string;
	pane_count: number;
	tab_count: number;
	agent_status: string;
};

export type KwTerminalTab = {
	tab_id: string;
	workspace_id: string;
	label: string;
	number: number;
	focused: boolean;
	pane_count: number;
	agent_status: string;
};

export type KwTerminalPane = {
	pane_id: string;
	tab_id: string;
	workspace_id: string;
	terminal_id: string;
	cwd: string;
	foreground_cwd: string;
	focused: boolean;
	revision: number;
	agent_status: string;
};

type KwTerminalEnvelope<TResult> = {
	id: string;
	result: TResult;
};

async function runKwTerminal(
	args: string[],
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
	const proc = Bun.spawn(["kw-terminal", ...args], {
		stdout: "pipe",
		stderr: "pipe",
		stdin: "ignore",
		env: spawnEnv(),
	});
	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const code = await proc.exited;

	return { ok: code === 0, stdout, stderr };
}

// Extrai `result` do envelope JSON de uma linha. `pane run`/`close` respondem vazio ou com
// `{"result":{"type":"ok"}}`, então quem chama esses trata o retorno como opaco.
export function parseKwTerminalResult<TResult>(stdout: string): TResult {
	const trimmed = stdout.trim();
	const envelope = JSON.parse(trimmed) as KwTerminalEnvelope<TResult>;

	return envelope.result;
}

// `kw-terminal status server` sai em texto plano (não JSON).
async function kwTerminalServerRunning(): Promise<boolean> {
	const { ok, stdout } = await runKwTerminal(["status", "server"]);

	return ok && /status:\s*running/.test(stdout);
}

// Paridade com o tmux, cuja CLI sobe o daemon sozinha no primeiro comando: se o servidor kw-terminal
// não está de pé, spawnamos `kw-terminal server` headless (daemon que sobrevive ao backend e loga em
// ~/.config/kw-terminal/kw-terminal-server.log) e aguardamos o socket responder. O cliente TUI que o
// usuário abrir depois atacha nesse mesmo servidor.
export async function ensureKwTerminalServer(): Promise<void> {
	if (await kwTerminalServerRunning()) {
		return;
	}

	Bun.spawn(["kw-terminal", "server"], {
		stdout: "ignore",
		stderr: "ignore",
		stdin: "ignore",
		env: spawnEnv(),
	}).unref();

	for (let attempt = 0; attempt < 25; attempt++) {
		await Bun.sleep(200);
		if (await kwTerminalServerRunning()) {
			return;
		}
	}

	throw new Error(
		"kw-terminal server não subiu — execute `kw-terminal` manualmente e tente de novo",
	);
}

// Argv do cliente TUI que o koworker spawna dentro do emulador quando não há nenhum aberto. `session
// attach default` atacha no server que ensureKwTerminalServer garante (o mesmo onde vivem os
// workspaces), espelhando o `tmux attach-session` do caminho tmux.
export const KW_TERMINAL_CLIENT_ARGV = ["kw-terminal", "session", "attach", "default"];

// O server kw-terminal não expõe contagem de clientes conectados pela CLI, então detectamos pelo
// processo: qualquer invocação do TUI (bare `kw-terminal`, `kw-terminal session attach ...`,
// `kw-terminal --session/--remote ...`) conta como cliente aberto; `kw-terminal server` (o daemon) e
// os subcomandos efêmeros (workspace/tab/pane/status/...) não.
export function isKwTerminalClientProcess(command: string): boolean {
	const trimmed = command.trim();

	return (
		trimmed === "kw-terminal" || /^kw-terminal (session attach|--session|--remote)\b/.test(trimmed)
	);
}

// Há um cliente TUI do kw-terminal realmente aberto? `pgrep` é unix, como o
// `sessionHasTerminalAttached` do caminho tmux (o modo kw-terminal também só roda em unix).
export async function kwTerminalClientAttached(): Promise<boolean> {
	const proc = Bun.spawn(["pgrep", "-af", "kw-terminal"], {
		stdout: "pipe",
		stderr: "ignore",
		stdin: "ignore",
		env: spawnEnv(),
	});
	const stdout = await new Response(proc.stdout).text();
	await proc.exited;

	return stdout
		.split("\n")
		.map((line) => line.replace(/^\d+\s+/, ""))
		.some(isKwTerminalClientProcess);
}

async function runKwTerminalJson<TResult>(args: string[]): Promise<TResult> {
	const { ok, stdout, stderr } = await runKwTerminal(args);
	if (!ok) {
		throw new Error(`Falha no comando kw-terminal (${args.join(" ")}): ${stderr.trim() || "erro"}`);
	}

	return parseKwTerminalResult<TResult>(stdout);
}

export async function kwTerminalWorkspaceList(): Promise<KwTerminalWorkspace[]> {
	const result = await runKwTerminalJson<{ workspaces: KwTerminalWorkspace[] }>([
		"workspace",
		"list",
	]);

	return result.workspaces;
}

export async function kwTerminalWorkspaceCreate(params: {
	cwd: string;
	label: string;
	focus?: boolean;
}): Promise<KwTerminalWorkspace> {
	const result = await runKwTerminalJson<{ workspace: KwTerminalWorkspace }>([
		"workspace",
		"create",
		"--cwd",
		params.cwd,
		"--label",
		params.label,
		params.focus ? "--focus" : "--no-focus",
	]);

	return result.workspace;
}

export async function kwTerminalWorkspaceGet(
	workspaceId: string,
): Promise<KwTerminalWorkspace | null> {
	const { ok, stdout } = await runKwTerminal(["workspace", "get", workspaceId]);
	if (!ok) {
		return null;
	}

	return parseKwTerminalResult<{ workspace: KwTerminalWorkspace }>(stdout).workspace;
}

export async function kwTerminalWorkspaceRename(
	workspaceId: string,
	label: string,
): Promise<KwTerminalWorkspace> {
	const result = await runKwTerminalJson<{ workspace: KwTerminalWorkspace }>([
		"workspace",
		"rename",
		workspaceId,
		label,
	]);

	return result.workspace;
}

export async function kwTerminalWorkspaceFocus(workspaceId: string): Promise<boolean> {
	return (await runKwTerminal(["workspace", "focus", workspaceId])).ok;
}

export async function kwTerminalWorkspaceClose(workspaceId: string): Promise<boolean> {
	return (await runKwTerminal(["workspace", "close", workspaceId])).ok;
}

export async function kwTerminalTabList(workspaceId: string): Promise<KwTerminalTab[]> {
	const result = await runKwTerminalJson<{ tabs: KwTerminalTab[] }>([
		"tab",
		"list",
		"--workspace",
		workspaceId,
	]);

	return result.tabs;
}

export async function kwTerminalTabCreate(params: {
	workspaceId: string;
	cwd: string;
	label: string;
	focus?: boolean;
}): Promise<{ tab: KwTerminalTab; rootPane: KwTerminalPane }> {
	const result = await runKwTerminalJson<{ tab: KwTerminalTab; root_pane: KwTerminalPane }>([
		"tab",
		"create",
		"--workspace",
		params.workspaceId,
		"--cwd",
		params.cwd,
		"--label",
		params.label,
		params.focus ? "--focus" : "--no-focus",
	]);

	return { tab: result.tab, rootPane: result.root_pane };
}

// Nova tab pela ação da página: sem cwd/label explícitos, o kw-terminal herda o cwd do workspace e
// numera a tab sozinho (ao contrário de `kwTerminalTabCreate`, que a fatia de invocação usa com
// cwd/label fixos).
export async function kwTerminalTabCreateInWorkspace(workspaceId: string): Promise<KwTerminalTab> {
	const result = await runKwTerminalJson<{ tab: KwTerminalTab }>([
		"tab",
		"create",
		"--workspace",
		workspaceId,
	]);

	return result.tab;
}

export async function kwTerminalTabRename(tabId: string, label: string): Promise<KwTerminalTab> {
	const result = await runKwTerminalJson<{ tab: KwTerminalTab }>(["tab", "rename", tabId, label]);

	return result.tab;
}

export async function kwTerminalTabFocus(tabId: string): Promise<boolean> {
	return (await runKwTerminal(["tab", "focus", tabId])).ok;
}

export async function kwTerminalTabClose(tabId: string): Promise<boolean> {
	return (await runKwTerminal(["tab", "close", tabId])).ok;
}

export async function kwTerminalPaneList(params: {
	workspaceId?: string;
	tabId?: string;
}): Promise<KwTerminalPane[]> {
	const args = ["pane", "list"];
	if (params.workspaceId) {
		args.push("--workspace", params.workspaceId);
	}

	const result = await runKwTerminalJson<{ panes: KwTerminalPane[] }>(args);
	const panes = result.panes;

	return params.tabId ? panes.filter((pane) => pane.tab_id === params.tabId) : panes;
}

export async function kwTerminalPaneRun(paneId: string, command: string): Promise<void> {
	const { ok, stderr } = await runKwTerminal(["pane", "run", paneId, command]);
	if (!ok) {
		throw new Error(`Falha ao executar comando no pane kw-terminal: ${stderr.trim() || "erro"}`);
	}
}

export async function kwTerminalPaneClose(paneId: string): Promise<boolean> {
	return (await runKwTerminal(["pane", "close", paneId])).ok;
}

// Lookup por label: pós-restart do backend o ID em memória some, mas o label (`sessionName` /
// `windowName`) é estável, então recuperamos o workspace/tab por ele antes de operar.
export async function findWorkspaceByLabel(label: string): Promise<KwTerminalWorkspace | null> {
	return (await kwTerminalWorkspaceList()).find((workspace) => workspace.label === label) ?? null;
}

export async function findTabByLabel(
	workspaceId: string,
	label: string,
): Promise<KwTerminalTab | null> {
	return (await kwTerminalTabList(workspaceId)).find((tab) => tab.label === label) ?? null;
}
