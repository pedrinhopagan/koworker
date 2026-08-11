import { dbAgentSessions } from "../../db/agent-sessions";
import { dbAgentSessionSnapshots } from "../../db/agent-session-snapshots";
import { dbExecutionRuns } from "../../db/execution-runs";
import { dbTasks } from "../../db/tasks";

// De onde veio o vínculo entre a conversa e a tarefa. Registro é o que o koworker anotou quando
// abriu a sessão; worktree é o diretório onde o agente rodou; menção é a pasta da tarefa citada no
// meio da conversa.
export type SessionTaskOrigin = "registro" | "worktree" | "mencao";

export type SessionTaskLink = {
	taskId: string;
	title: string | null;
	projectId: string;
	origin: SessionTaskOrigin;
};

type TaskRow = {
	id: string;
	project_id: string;
	title?: string | null;
	folder_path: string;
	worktree_path?: string | null;
};

export type HistoryTaskIndex = {
	byFolderPath: Map<string, TaskRow[]>;
	worktrees: { path: string; task: TaskRow }[];
	byCliSession: Map<string, { taskId: string; title: string | null }>;
};

// Uma leitura só de banco para a lista inteira: o índice é montado por requisição e consultado em
// memória para cada conversa.
export async function loadHistoryTaskIndex(): Promise<HistoryTaskIndex> {
	const [tasks, sessions, runs, snapshots] = await Promise.all([
		dbTasks.listPathIndex(),
		dbAgentSessions.listCliLinks(),
		dbExecutionRuns.listCliSessionLinks(),
		dbAgentSessionSnapshots.list(),
	]);

	const byFolderPath = new Map<string, TaskRow[]>();
	const worktrees: HistoryTaskIndex["worktrees"] = [];

	for (const task of tasks) {
		const known = byFolderPath.get(task.folder_path);
		if (known) {
			known.push(task);
		} else {
			byFolderPath.set(task.folder_path, [task]);
		}

		if (task.worktree_path) {
			worktrees.push({ path: task.worktree_path, task });
		}
	}

	const byCliSession = new Map<string, { taskId: string; title: string | null }>();

	function link(
		sessionId: string | null | undefined,
		taskId: string | null | undefined,
		title: string | null | undefined,
	) {
		if (sessionId && taskId && !byCliSession.has(sessionId)) {
			byCliSession.set(sessionId, { taskId, title: title ?? null });
		}
	}

	for (const session of sessions) {
		// No claude o id da sessão do koworker é o id do CLI; no codex é o `cli_session_id` que o
		// `codex exec resume` exige. Registrar os dois cobre as duas CLIs sem ramificar.
		link(session.id, session.task_id, session.task_title);
		link(session.cli_session_id, session.task_id, session.task_title);
	}

	for (const run of runs) {
		link(run.cli_session_id, run.task_id, run.task_title);
	}

	for (const snapshot of snapshots) {
		link(snapshot.session_id, snapshot.task_id, snapshot.task_title);
	}

	return { byFolderPath, worktrees, byCliSession };
}

function insideWorktree(cwd: string, worktree: string) {
	return cwd === worktree || cwd.startsWith(`${worktree}/`);
}

// A mesma pasta relativa pode existir em dois projetos: quando a conversa tem projeto, ele desempata;
// sem projeto, a pasta só vale se apontar para uma tarefa só.
function taskForFolder(index: HistoryTaskIndex, folderPath: string, projectId: string | null) {
	const candidates = index.byFolderPath.get(folderPath) ?? [];
	if (candidates.length === 1) {
		return candidates[0] ?? null;
	}

	return candidates.find((task) => task.project_id === projectId) ?? null;
}

export function resolveSessionTasks(input: {
	index: HistoryTaskIndex;
	sessionId: string;
	cwd: string | null;
	projectId: string | null;
	taskFolderPaths: string[];
}): SessionTaskLink[] {
	const links = new Map<string, SessionTaskLink>();

	function add(link: SessionTaskLink) {
		if (!links.has(link.taskId)) {
			links.set(link.taskId, link);
		}
	}

	const registered = input.index.byCliSession.get(input.sessionId);
	if (registered) {
		add({
			taskId: registered.taskId,
			title: registered.title,
			projectId: input.projectId ?? "",
			origin: "registro",
		});
	}

	if (input.cwd) {
		for (const worktree of input.index.worktrees) {
			if (insideWorktree(input.cwd, worktree.path)) {
				add({
					taskId: worktree.task.id,
					title: worktree.task.title ?? null,
					projectId: worktree.task.project_id,
					origin: "worktree",
				});
			}
		}
	}

	for (const folderPath of input.taskFolderPaths) {
		const task = taskForFolder(input.index, folderPath, input.projectId);
		if (task) {
			add({
				taskId: task.id,
				title: task.title ?? null,
				projectId: task.project_id,
				origin: "mencao",
			});
		}
	}

	return [...links.values()];
}
