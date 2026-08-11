import { ORPCError } from "@orpc/server";
import { realpathSync } from "node:fs";

import type { AgentSessionEvent } from "@/lib/agent-session";
import { dbProjects } from "../../db/projects";
import { listRadarAgents, matchProjectByCwd } from "../agent-radar/state";
import { mapWithConcurrency } from "../concurrency";
import { toDisplayPath } from "../display-path";
import { Terminal } from "../terminal/service";
import { readSessionDigest, readSessionEvents } from "./digest";
import { readSessionHead, type CliSessionHead } from "./head";
import {
	loadHistoryTaskIndex,
	resolveSessionTasks,
	type HistoryTaskIndex,
	type SessionTaskLink,
} from "./links";
import {
	listClaudeSessionFiles,
	listCodexSessionFiles,
	type CliSessionFile,
	type HistoryCli,
} from "./paths";

// Ler cabeçalho é abrir arquivo: sem teto, uma máquina com milhares de conversas antigas abriria
// todas de uma vez.
const READ_CONCURRENCY = 24;

// Uma pasta de tarefa citada uma vez só é quase sempre respingo: a saída de um `ls`, uma listagem do
// banco, um caminho colado por engano. A tarefa que a sessão realmente tocou aparece de novo e de
// novo, porque o agente lê, escreve e cita os `.md` dela o tempo todo.
const TASK_MENTION_MIN_HITS = 2;
const TASK_MENTION_LIMIT = 6;

export type CliSessionSummary = {
	cli: HistoryCli;
	sessionId: string;
	path: string;
	cwd: string | null;
	// O mesmo caminho com o home trocado por `~`: só o backend conhece o home.
	cwdLabel: string | null;
	gitBranch: string | null;
	startedAt: number | null;
	updatedAt: number;
	sizeBytes: number;
	title: string | null;
	preview: string | null;
	projectId: string | null;
	projectName: string | null;
	tasks: SessionTaskLink[];
	// O pane onde essa mesma conversa está aberta agora, quando está. É o que faz abrir cair no
	// terminal vivo em vez de subir outro processo em cima do mesmo histórico.
	livePaneId: string | null;
};

export type CliSessionDetail = CliSessionSummary & { events: AgentSessionEvent[] };

type Project = { id: string; name: string; main_route: string };

type Candidate = { file: CliSessionFile; head: CliSessionHead; project: Project | null };

function normalize(value: string) {
	return value
		.toLowerCase()
		.normalize("NFD")
		.replaceAll(/\p{Diacritic}/gu, "");
}

function livePanes() {
	const panes = new Map<string, string>();

	for (const agent of listRadarAgents()) {
		if (agent.sessionId) {
			panes.set(agent.sessionId, agent.paneId);
		}
	}

	return panes;
}

// O projeto pode estar cadastrado por um link simbólico enquanto o terminal rodou pelo caminho real
// (ou o contrário): as duas formas da raiz entram na busca.
function projectRoots(project: Project | null) {
	if (!project) {
		return [];
	}

	try {
		return [...new Set([project.main_route, realpathSync(project.main_route)])];
	} catch {
		return [project.main_route];
	}
}

function candidateFiles(input: { cli: HistoryCli | null; project: Project | null }) {
	const files: CliSessionFile[] = [];

	if (input.cli !== "codex") {
		files.push(...listClaudeSessionFiles(projectRoots(input.project)));
	}
	if (input.cli !== "claude") {
		files.push(...listCodexSessionFiles());
	}

	return files;
}

async function readCandidates(input: {
	files: CliSessionFile[];
	projects: Project[];
	project: Project | null;
}): Promise<Candidate[]> {
	const heads = await mapWithConcurrency(input.files, READ_CONCURRENCY, (file) =>
		readSessionHead(file),
	);

	return input.files.flatMap((file, index) => {
		const head = heads[index];
		if (!head?.root) {
			return [];
		}

		// A pasta do claude já garantiu o projeto quando o filtro está ligado; transcript que não
		// registrou `cwd` em nenhuma linha do começo continua sendo daquele projeto.
		const project = head.cwd ? matchProjectByCwd(input.projects, head.cwd) : input.project;
		if (input.project && project?.id !== input.project.id) {
			return [];
		}

		return [{ file, head, project }];
	});
}

function matchesSearch(candidate: Candidate, search: string) {
	if (!search) {
		return true;
	}

	const haystack = normalize(
		[
			candidate.head.title,
			candidate.head.cwd,
			candidate.head.gitBranch,
			candidate.project?.name,
			candidate.file.sessionId,
		]
			.filter(Boolean)
			.join(" "),
	);

	return search
		.split(/\s+/)
		.filter(Boolean)
		.every((term) => haystack.includes(term));
}

async function describe(input: {
	file: CliSessionFile;
	head: CliSessionHead;
	project: Project | null;
	index: HistoryTaskIndex;
	panes: Map<string, string>;
}): Promise<CliSessionSummary> {
	const digest = await readSessionDigest(input.file);
	// O título só é procurado fundo no arquivo quando o item de fato vai aparecer: conversa que
	// começou com muito contexto injetado esconde a primeira fala depois de centenas de KB.
	const head = input.head.title ? input.head : await readSessionHead(input.file, { deep: true });

	return {
		cli: input.file.cli,
		sessionId: input.file.sessionId,
		path: input.file.path,
		cwd: head.cwd,
		cwdLabel: head.cwd ? toDisplayPath(head.cwd) : null,
		gitBranch: head.gitBranch,
		startedAt: head.startedAt,
		updatedAt: input.file.updatedAt,
		sizeBytes: input.file.sizeBytes,
		title: head.title,
		preview: digest.preview,
		projectId: input.project?.id ?? null,
		projectName: input.project?.name ?? null,
		tasks: resolveSessionTasks({
			index: input.index,
			sessionId: input.file.sessionId,
			cwd: head.cwd,
			projectId: input.project?.id ?? null,
			taskFolderPaths: digest.taskFolderPaths
				.filter((mention) => mention.count >= TASK_MENTION_MIN_HITS)
				.slice(0, TASK_MENTION_LIMIT)
				.map((mention) => mention.path),
		}),
		livePaneId: input.panes.get(input.file.sessionId) ?? null,
	};
}

export async function listCliSessions(input: {
	projectId: string | null;
	cli: HistoryCli | null;
	search: string;
	limit: number;
	offset: number;
}) {
	const projects = await dbProjects.getAll();
	const project = input.projectId
		? (projects.find((candidate) => candidate.id === input.projectId) ?? null)
		: null;

	if (input.projectId && !project) {
		throw new ORPCError("NOT_FOUND", { message: "Projeto não encontrado" });
	}

	const files = candidateFiles({ cli: input.cli, project });
	const candidates = (await readCandidates({ files, projects, project }))
		.filter((candidate) => matchesSearch(candidate, normalize(input.search.trim())))
		.sort((left, right) => right.file.updatedAt - left.file.updatedAt);

	const page = candidates.slice(input.offset, input.offset + input.limit);
	const index = await loadHistoryTaskIndex();
	const panes = livePanes();
	const sessions = await mapWithConcurrency(page, READ_CONCURRENCY, (candidate) =>
		describe({ ...candidate, index, panes }),
	);

	return {
		sessions,
		total: candidates.length,
		hasMore: input.offset + page.length < candidates.length,
	};
}

function locate(cli: HistoryCli, sessionId: string) {
	const files = cli === "claude" ? listClaudeSessionFiles() : listCodexSessionFiles();
	const file = files.find((candidate) => candidate.sessionId === sessionId);

	if (!file) {
		throw new ORPCError("NOT_FOUND", { message: "Esta conversa não existe mais no disco" });
	}

	return file;
}

export async function getCliSession(input: {
	cli: HistoryCli;
	sessionId: string;
}): Promise<CliSessionDetail> {
	const file = locate(input.cli, input.sessionId);
	const [projects, head, index, events] = await Promise.all([
		dbProjects.getAll(),
		readSessionHead(file, { deep: true }),
		loadHistoryTaskIndex(),
		readSessionEvents(file),
	]);
	const project = head.cwd ? matchProjectByCwd(projects, head.cwd) : null;
	const summary = await describe({ file, head, project, index, panes: livePanes() });

	return { ...summary, events };
}

// Retomar é subir a CLI de novo, na mesma pasta e com o mesmo id de conversa. Se a sessão já está
// aberta num pane, não sobe nada: o pane vivo é a própria conversa.
export async function resumeCliSession(input: { cli: HistoryCli; sessionId: string }) {
	const live = livePanes().get(input.sessionId);
	if (live) {
		return { paneId: live, reused: true };
	}

	const file = locate(input.cli, input.sessionId);
	const head = await readSessionHead(file);
	if (!head.cwd) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Esta conversa não registrou o diretório onde rodou",
		});
	}

	const projects = await dbProjects.getAll();
	const project = matchProjectByCwd(projects, head.cwd);
	const { paneId } = await Terminal.resumeSessionById({
		projectName: project?.name ?? null,
		mainRoute: project?.main_route ?? head.cwd,
		cwd: head.cwd,
		cli: file.cli,
		sessionId: file.sessionId,
	});

	return { paneId, reused: false };
}

export async function cliSessionCwd(input: { cli: HistoryCli; sessionId: string }) {
	const head = await readSessionHead(locate(input.cli, input.sessionId));
	if (!head.cwd) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Esta conversa não registrou o diretório onde rodou",
		});
	}

	return head.cwd;
}
