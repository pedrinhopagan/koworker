import { cp, mkdir, readdir, rename, rm, stat, utimes } from "node:fs/promises";
import { dirname, join } from "node:path";

import { COMPLEXITY_FLOWS, type TaskComplexity, type TaskStage } from "@/constants/complexity";

// Garante que `.koworker/` está no `.gitignore` do projeto. O conteúdo das tasks é
// canônico no FS mas nunca deve ir pro git. Idempotente: só faz append se faltar.
async function ensureKoworkerGitignored(projectRoute: string): Promise<void> {
	const gitignorePath = join(projectRoute, ".gitignore");
	const file = Bun.file(gitignorePath);

	const current = (await file.exists()) ? await file.text() : "";
	const alreadyIgnored = current
		.split("\n")
		.some((line) => line.trim().replace(/\/$/, "") === ".koworker");
	if (alreadyIgnored) return;

	const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
	await Bun.write(gitignorePath, `${current}${prefix}.koworker/\n`);
}

export type TaskFile = {
	name: string;
	content: string;
	// Tamanho em bytes do arquivo em disco.
	size: number;
	// birthtime do arquivo em disco: instante de criação, estável entre edições.
	createdAt: number;
	// mtime do arquivo em disco; base do ranking de recência dos arquivos na rota da task.
	editedAt: number;
};

const KOWORKER_DIR = ".koworker";
export const PRIMARY_FILE = "index.md";

const DISPLAY_TITLE_FALLBACK = "Sem título";
const DISPLAY_TITLE_MAX_LENGTH = 80;

// Ordena os .md da pasta: index.md primeiro, o resto alfabético.
function compareMarkdownNames(a: string, b: string): number {
	if (a === PRIMARY_FILE) return -1;
	if (b === PRIMARY_FILE) return 1;
	return a.localeCompare(b);
}

// index.md fica sempre na primeira aba, sem exceção — nem a ordem manual nem o birthtime o
// deslocam (o agente recria o arquivo e ele nasceria com birthtime novo, indo parar à direita).
// Depois dele: os nomes em `order` na ordem gravada; os de fora (arquivos novos, ainda sem reorder)
// entram por birthtime crescente — o mais recente à direita.
function orderTaskFiles(files: TaskFile[], order: string[]): TaskFile[] {
	const index = new Map(order.map((name, i) => [name, i] as const));
	return [...files].sort((a, b) => {
		if (a.name === PRIMARY_FILE) return -1;
		if (b.name === PRIMARY_FILE) return 1;

		const ia = index.get(a.name);
		const ib = index.get(b.name);
		if (ia !== undefined && ib !== undefined) return ia - ib;
		if (ia !== undefined) return -1;
		if (ib !== undefined) return 1;
		return a.createdAt - b.createdAt || compareMarkdownNames(a.name, b.name);
	});
}

// Primeira linha não-vazia do conteúdo, com markup de heading removido e truncada.
function firstMeaningfulLine(content: string): string | null {
	for (const line of content.split("\n")) {
		const stripped = line.replace(/^#{1,6}\s+/, "").trim();
		if (stripped) return stripped.slice(0, DISPLAY_TITLE_MAX_LENGTH);
	}
	return null;
}

// O nome exibido da task: o título do banco quando há, senão o começo do primeiro .md,
// senão um placeholder. É a única fonte do que a UI renderiza como nome da task. fromContent
// distingue o snippet do .md do fallback "Sem título" — a UI usa isso pra deixar claro, na edição,
// que o nome mostrado é só o início do conteúdo e não um título de verdade.
export function resolveDisplayTitle(params: { title?: string; firstContent?: string }): {
	title: string;
	fromContent: boolean;
} {
	const title = params.title?.trim();
	if (title) return { title, fromContent: false };

	const fromContent = params.firstContent ? firstMeaningfulLine(params.firstContent) : null;
	if (fromContent) return { title: fromContent, fromContent: true };

	return { title: DISPLAY_TITLE_FALLBACK, fromContent: false };
}

// Pasta da task relativa ao project.main_route, ex: ".koworker/3f2a8b1c". S\u00F3 o id curto,
// sem slug do t\u00EDtulo \u2014 o t\u00EDtulo vive no banco, n\u00E3o no nome da pasta nem no H1 do index.md.
export function buildFolderPath(id: string): string {
	return join(KOWORKER_DIR, id.slice(0, 8));
}

// Cria a pasta da task com o index.md semeado pelo título (H1), pra que o prompt copiado
// referencie um arquivo com conteúdo já na criação. Sem título, o arquivo nasce vazio e a
// UI mostra o placeholder de escrita. Com `seed: false` a pasta nasce vazia (sem index.md):
// é o caso de uma task criada só pra receber arquivos redirecionados do vault.
export async function createTaskFolder(params: {
	projectRoute: string;
	folderPath: string;
	title?: string;
	seed?: boolean;
}): Promise<void> {
	await ensureKoworkerGitignored(params.projectRoute);

	const dir = join(params.projectRoute, params.folderPath);
	await mkdir(dir, { recursive: true });

	if (params.seed === false) return;

	await Bun.write(join(dir, PRIMARY_FILE), params.title ? `# ${params.title}\n` : "");
}

// Lista só os nomes dos .md da pasta, na ordem canônica (index.md primeiro, depois alfabético).
// Usado pela listagem de tasks pra mostrar quantos arquivos a task tem sem ler o conteúdo.
export async function listTaskMarkdownNames(params: {
	projectRoute: string;
	folderPath: string;
}): Promise<string[]> {
	const dir = join(params.projectRoute, params.folderPath);

	try {
		const entries = (await readdir(dir, { withFileTypes: true }))
			.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
			.map((entry) => entry.name);
		entries.sort(compareMarkdownNames);
		return entries;
	} catch {
		return [];
	}
}

// Nomes dos .md + o instante da última edição (maior mtime entre eles), numa só leitura de
// pasta. lastEditedAt fica undefined quando a pasta não tem .md. Pega edições feitas direto no
// disco (ex.: pelo agente), não só pela UI.
export async function readTaskFolderMeta(params: {
	projectRoute: string;
	folderPath: string;
}): Promise<{ fileNames: string[]; artifactNames: string[]; lastEditedAt?: number }> {
	const dir = join(params.projectRoute, params.folderPath);

	let entries: { isFile: () => boolean; name: string }[];
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return { fileNames: [], artifactNames: [] };
	}

	const fileNames = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) => entry.name);
	const artifactNames = entries
		.filter((entry) => entry.isFile() && !entry.name.endsWith(".md"))
		.map((entry) => entry.name);

	fileNames.sort(compareMarkdownNames);
	artifactNames.sort((a, b) => a.localeCompare(b, "pt-BR"));
	if (fileNames.length === 0) return { fileNames, artifactNames };

	const mtimes = await Promise.all(
		fileNames.map((name) =>
			stat(join(dir, name))
				.then((s) => s.mtimeMs)
				.catch(() => 0),
		),
	);

	return { fileNames, artifactNames, lastEditedAt: Math.max(...mtimes) };
}

// Etapas cujo artefato já existe na pasta, provadas por convenção de nome. O index.md não conta;
// grill*.md prova o grill, plano*.md/plan*.md o plano, revis*.md a revisão, e qualquer outro .md
// prova que a execução (em fase única ou em fases) começou.
function provenStages(fileNames: string[]): Set<TaskStage> {
	const proven = new Set<TaskStage>();
	for (const name of fileNames) {
		const lower = name.toLowerCase();
		if (lower === PRIMARY_FILE) continue;

		if (lower.startsWith("grill")) {
			proven.add("grill");
		} else if (lower.startsWith("plano") || lower.startsWith("plan")) {
			proven.add("plano");
		} else if (lower.startsWith("revis")) {
			proven.add("revisao");
		} else {
			proven.add("execucao");
			proven.add("execucao-fases");
		}
	}
	return proven;
}

// Primeira etapa do fluxo da complexidade ainda sem artefato na pasta — o próximo passo da tarefa.
// null quando o fluxo está completo. A complexidade vem do banco (união já garantida na boundary);
// os artefatos vêm do disco, então uma etapa feita direto pelo agente conta sem passar pela UI.
export function inferTaskStage(params: {
	fileNames: string[];
	complexity: TaskComplexity;
}): TaskStage | null {
	const proven = provenStages(params.fileNames);
	return COMPLEXITY_FLOWS[params.complexity].find((stage) => !proven.has(stage)) ?? null;
}

// Conteúdo do primeiro .md da pasta (mesma ordem de readTaskFiles), para o fallback de
// exibição das tasks sem título. Lê só um arquivo, não a pasta inteira.
export async function readFirstMarkdownContent(params: {
	projectRoute: string;
	folderPath: string;
}): Promise<string | undefined> {
	const dir = join(params.projectRoute, params.folderPath);

	let entries: string[];
	try {
		entries = (await readdir(dir, { withFileTypes: true }))
			.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
			.map((entry) => entry.name);
	} catch {
		return undefined;
	}

	const first = entries.sort(compareMarkdownNames).at(0);
	if (!first) return undefined;

	return Bun.file(join(dir, first)).text();
}

// Lê todos os .md da pasta na ordem manual das abas (`order`): os nomes gravados primeiro, os de
// fora à direita por birthtime. Sem `order`, cai no birthtime — index.md à esquerda por padrão.
export async function readTaskFiles(params: {
	projectRoute: string;
	folderPath: string;
	order?: string[];
}): Promise<{ files: TaskFile[]; primaryFile: string | null }> {
	const dir = join(params.projectRoute, params.folderPath);

	let entries: string[];
	try {
		entries = (await readdir(dir, { withFileTypes: true }))
			.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
			.map((entry) => entry.name);
	} catch {
		return { files: [], primaryFile: null };
	}

	const files = await Promise.all(
		entries.map(async (name) => {
			const path = join(dir, name);
			const [content, stats] = await Promise.all([
				Bun.file(path).text(),
				stat(path).catch(() => null),
			]);
			return {
				name,
				content,
				size: stats?.size ?? 0,
				createdAt: stats?.birthtimeMs ?? 0,
				editedAt: stats?.mtimeMs ?? 0,
			};
		}),
	);

	const ordered = orderTaskFiles(files, params.order ?? []);

	const primaryFile =
		ordered.find((file) => file.name === PRIMARY_FILE)?.name ?? ordered[0]?.name ?? null;
	return { files: ordered, primaryFile };
}

export function parseTaskFileOrder(raw: string | null | undefined): string[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed) && parsed.every((name) => typeof name === "string")) return parsed;
	} catch {
		return [];
	}
	return [];
}

export async function taskFileExists(params: {
	projectRoute: string;
	folderPath: string;
	name: string;
}): Promise<boolean> {
	try {
		await stat(join(params.projectRoute, params.folderPath, params.name));
		return true;
	} catch {
		return false;
	}
}

export async function readTaskFile(params: {
	projectRoute: string;
	folderPath: string;
	name: string;
}): Promise<string> {
	const path = join(params.projectRoute, params.folderPath, params.name);
	const file = Bun.file(path);
	if (!(await file.exists())) {
		throw new Error(`Arquivo "${params.name}" não encontrado nesta tarefa`);
	}
	return file.text();
}

export async function writeTaskFile(params: {
	projectRoute: string;
	folderPath: string;
	name: string;
	content: string;
}): Promise<void> {
	const dir = join(params.projectRoute, params.folderPath);
	await mkdir(dir, { recursive: true });
	await Bun.write(join(dir, params.name), params.content);
}

// Sobrescreve o mtime de um .md — a "data de atualização" que baseia toda a recência (lista,
// abas da task, watcher). O birthtime (criação) não muda: utimes no Linux não mexe nele. Permite
// jogar pra trás tarefas/arquivos que não interessam sem editar o conteúdo.
export async function setTaskFileEditedAt(params: {
	projectRoute: string;
	folderPath: string;
	name: string;
	editedAt: number;
}): Promise<void> {
	const when = new Date(params.editedAt);
	await utimes(join(params.projectRoute, params.folderPath, params.name), when, when);
}

export async function renameTaskFile(params: {
	projectRoute: string;
	folderPath: string;
	oldName: string;
	newName: string;
}): Promise<void> {
	const dir = join(params.projectRoute, params.folderPath);
	const destPath = join(dir, params.newName);

	const exists = await stat(destPath)
		.then(() => true)
		.catch(() => false);
	if (exists) throw new Error(`Arquivo "${params.newName}" já existe nesta tarefa`);

	await rename(join(dir, params.oldName), destPath);
}

// Apaga um `.md` da pasta da task. `force` evita estourar se o arquivo já não existir.
export async function deleteTaskFile(params: {
	projectRoute: string;
	folderPath: string;
	name: string;
}): Promise<void> {
	await rm(join(params.projectRoute, params.folderPath, params.name), { force: true });
}

// Move a pasta da task de um projeto para outro: o folder_path (relativo) é o mesmo, muda só a raiz.
// Garante o `.gitignore` do destino e cria o `.koworker/` se ainda não existir lá. Recusa se o
// destino já tiver uma pasta com esse nome — colisão do id curto não pode mesclar tarefas. Projetos
// podem viver em mounts distintos, então rename pode dar EXDEV: nesse caso copia e remove a origem.
export async function moveTaskFolderToProject(params: {
	fromRoute: string;
	toRoute: string;
	folderPath: string;
}): Promise<void> {
	await ensureKoworkerGitignored(params.toRoute);

	const from = join(params.fromRoute, params.folderPath);
	const to = join(params.toRoute, params.folderPath);

	const exists = await stat(to)
		.then(() => true)
		.catch(() => false);
	if (exists) throw new Error("Já existe uma tarefa com esse identificador no projeto de destino");

	await mkdir(dirname(to), { recursive: true });
	try {
		await rename(from, to);
	} catch (err: any) {
		if (err?.code !== "EXDEV") throw err;
		await cp(from, to, { recursive: true });
		await rm(from, { recursive: true, force: true });
	}
}

export async function removeTaskFolder(params: {
	projectRoute: string;
	folderPath: string;
}): Promise<void> {
	await rm(join(params.projectRoute, params.folderPath), { recursive: true, force: true });
}
