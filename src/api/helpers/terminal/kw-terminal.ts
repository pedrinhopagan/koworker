import { spawnEnv } from "@/api/helpers/spawn";
import { z } from "zod";

const KwTerminalAgentSessionSchema = z
	.object({
		agent: z.string(),
		kind: z.enum(["id", "path"]),
		source: z.string(),
		value: z.string().trim().min(1),
	})
	.strict();

const KwTerminalErrorSchema = z.object({
	error: z.object({ code: z.string(), message: z.string() }),
});

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

// `agent`, `activity` e `title` só vêm quando o pane tem um agent detectado com o que dizer: o
// daemon omite o campo em vez de mandar nulo.
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
	agent?: string;
	activity?: string;
	title?: string;
	agent_session?: z.infer<typeof KwTerminalAgentSessionSchema> | null;
	agent_session_id?: string | null;
	agent_session_path?: string | null;
};

export type KwTerminalPaneProcessInfo = {
	pane_id: string;
	shell_pid: number;
	foreground_process_group_id: number;
	foreground_processes: {
		pid: number;
		name: string;
		cmdline: string;
		argv: string[];
		cwd: string;
	}[];
};

export function kwTerminalPaneSession(
	pane: Pick<KwTerminalPane, "agent" | "agent_session" | "agent_session_id" | "agent_session_path">,
) {
	const parsed = KwTerminalAgentSessionSchema.safeParse(pane.agent_session);
	if (parsed.success && parsed.data.agent === pane.agent) {
		return parsed.data.kind === "id"
			? { sessionId: parsed.data.value, sessionPath: null }
			: { sessionId: null, sessionPath: parsed.data.value };
	}
	if (pane.agent_session !== undefined && pane.agent_session !== null) {
		return { sessionId: null, sessionPath: null };
	}

	const sessionPath = pane.agent_session_path?.trim() || null;

	return sessionPath
		? { sessionId: null, sessionPath }
		: { sessionId: pane.agent_session_id?.trim() || null, sessionPath: null };
}

// A tarefa que o agent anunciou estar tocando (`pane report-task`). Só o `agent list` devolve.
export type KwTerminalSessionTask = {
	task_id: string;
	title: string;
	route: string;
	file_route?: string;
};

// Agent detectado pelo kw-terminal dentro de um pane: `agent` é o binário reconhecido (`claude`,
// `codex`...) e `cwd` é o diretório onde ele foi aberto — é por eles que casamos a sessão do CLI
// ativo com o projeto em foco.
export type KwTerminalAgent = {
	agent: string;
	agent_status: string;
	cwd: string;
	foreground_cwd: string;
	focused: boolean;
	pane_id: string;
	tab_id: string;
	terminal_id: string;
	workspace_id: string;
	session_task?: KwTerminalSessionTask | null;
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

// Caminho do socket unix onde o daemon atende. Sai do próprio `status server` em vez de ser
// remontado a partir de XDG_CONFIG_HOME: o kw-terminal escolhe o diretório por sessão nomeada e
// aceita override por env, e adivinhar isso aqui daria um caminho errado sem aviso.
export async function kwTerminalSocketPath(): Promise<string> {
	const { ok, stdout } = await runKwTerminal(["status", "server"]);
	const socket = ok ? /^socket:\s*(.+)$/m.exec(stdout)?.[1]?.trim() : null;

	if (!socket) {
		throw new Error("kw-terminal não informou o caminho do socket");
	}

	return socket;
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

export async function kwTerminalPaneProcessInfo(
	paneId: string,
): Promise<KwTerminalPaneProcessInfo> {
	const result = await runKwTerminalJson<{ process_info: KwTerminalPaneProcessInfo }>([
		"pane",
		"process-info",
		"--pane",
		paneId,
	]);

	return result.process_info;
}

export async function kwTerminalPaneGet(paneId: string): Promise<KwTerminalPane | null> {
	const { ok, stdout, stderr } = await runKwTerminal(["pane", "get", paneId]);
	if (!ok) {
		let payload: unknown = null;
		try {
			payload = JSON.parse(stdout);
		} catch {
			payload = null;
		}
		const parsed = KwTerminalErrorSchema.safeParse(payload);
		if (parsed.success && parsed.data.error.code === "pane_not_found") {
			return null;
		}

		throw new Error(
			`Falha ao consultar pane kw-terminal: ${parsed.success ? parsed.data.error.message : stderr.trim() || "erro"}`,
		);
	}

	return parseKwTerminalResult<{ pane: KwTerminalPane }>(stdout).pane;
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

export async function kwTerminalIntegrationInstall(cli: "claude" | "codex"): Promise<void> {
	const { ok, stderr } = await runKwTerminal(["integration", "install", cli]);
	if (!ok) {
		throw new Error(
			`Falha ao instalar a integração ${cli} do kw-terminal: ${stderr.trim() || "erro"}`,
		);
	}
}

export async function kwTerminalAgentList(): Promise<KwTerminalAgent[]> {
	const result = await runKwTerminalJson<{ agents: KwTerminalAgent[] }>(["agent", "list"]);

	return result.agents;
}

// `target` aceita terminal id, nome do agent ou pane id; usamos o `terminal_id` do `agent list`, que
// é o identificador estável do agent detectado.
export async function kwTerminalAgentFocus(target: string): Promise<boolean> {
	return (await runKwTerminal(["agent", "focus", target])).ok;
}

// Escreve o texto no prompt do agent sem submeter: quem envia decide quando o Enter vai.
export async function kwTerminalAgentSend(target: string, text: string): Promise<void> {
	const { ok, stderr } = await runKwTerminal(["agent", "send", target, text]);
	if (!ok) {
		throw new Error(`Falha ao escrever no agent do kw-terminal: ${stderr.trim() || "erro"}`);
	}
}

export async function kwTerminalAgentSubmit(
	target: string,
	text: string,
	revalidate: () => void,
): Promise<void> {
	revalidate();
	await kwTerminalAgentSend(target, text);
	revalidate();
	await kwTerminalPaneSendKeys(target, "Enter");
}

export async function kwTerminalAgentInterrupt(paneId: string): Promise<void> {
	await kwTerminalPaneSendKeys(paneId, "C-c");
}

export async function kwTerminalPaneSendKeys(paneId: string, ...keys: string[]): Promise<void> {
	const { ok, stderr } = await runKwTerminal(["pane", "send-keys", paneId, ...keys]);
	if (!ok) {
		throw new Error(`Falha ao enviar tecla ao pane kw-terminal: ${stderr.trim() || "erro"}`);
	}
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

// Único jeito de obter um workspace no kw-terminal: reusa o que já tem o label, cria só quando não
// existe. Criar sem consultar duplicaria o grupo do projeto a cada restart do backend, já que o ID
// do daemon é volátil e o label é o que sobrevive.
export async function ensureWorkspaceByLabel(params: {
	label: string;
	cwd: string;
}): Promise<{ workspace: KwTerminalWorkspace; isNew: boolean }> {
	const existing = await findWorkspaceByLabel(params.label);
	if (existing) {
		return { workspace: existing, isNew: false };
	}

	const workspace = await kwTerminalWorkspaceCreate({
		cwd: params.cwd,
		label: params.label,
		focus: false,
	});

	return { workspace, isNew: true };
}
