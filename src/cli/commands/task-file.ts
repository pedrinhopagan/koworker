import { dbProjects } from "@/api/db/projects";
import { dbTasks } from "@/api/db/tasks";
import {
	deleteTaskFile,
	parseTaskFileOrder,
	readTaskFile,
	readTaskFiles,
	renameTaskFile,
	setTaskFileEditedAt,
	taskFileExists,
	writeTaskFile,
} from "@/api/helpers/task-folder";
import {
	TaskDeleteFileSchema,
	TaskRenameFileSchema,
	TaskReorderFilesSchema,
	TaskSetFileDateSchema,
	TaskWriteFileSchema,
} from "@/api/schemas/tasks";
import { hasFlag, parseArgs } from "../args";
import { notifyTasksChanged } from "../notify";
import { resolveTask } from "../resolve";

export function runTaskFile(args: string[]): Promise<void> {
	const [sub, ...rest] = args;

	if (sub === "list" || sub === "ls") {
		return runFileList(rest);
	}
	if (sub === "read" || sub === "cat") {
		return runFileRead(rest);
	}
	if (sub === "create") {
		return runFileWrite(rest, { createOnly: true });
	}
	if (sub === "write" || sub === "set") {
		return runFileWrite(rest, { createOnly: false });
	}
	if (sub === "rename" || sub === "mv") {
		return runFileRename(rest);
	}
	if (sub === "rm" || sub === "delete") {
		return runFileRm(rest);
	}
	if (sub === "reorder") {
		return runFileReorder(rest);
	}
	if (sub === "date") {
		return runFileDate(rest);
	}

	throw new Error(
		`Subcomando desconhecido: task file ${sub ?? ""}. Use: list | read | create | write | rename | rm | reorder | date`,
	);
}

async function runFileList(args: string[]): Promise<void> {
	const raw = args[0];
	if (!raw) {
		throw new Error("Uso: kw-cli task file list <taskId|caminho>");
	}

	const row = await requireTask(raw);
	const project = await requireProject(row.project_id);
	const { files } = await readTaskFiles({
		projectRoute: project.main_route,
		folderPath: row.folder_path,
		order: parseTaskFileOrder(row.file_order),
	});

	if (files.length === 0) {
		console.log("Nenhum arquivo .md encontrado.");
		return;
	}

	for (const file of files) {
		console.log(`${file.name}\t${file.content.length} chars\t${formatInstant(file.editedAt)}`);
	}
}

async function runFileRead(args: string[]): Promise<void> {
	const { row, name } = await resolveTaskFileTarget(args[0], args[1], "read");
	const input = TaskDeleteFileSchema.parse({ id: row.id, name });
	const project = await requireProject(row.project_id);
	const content = await readTaskFile({
		projectRoute: project.main_route,
		folderPath: row.folder_path,
		name: input.name,
	});

	console.log(content);
}

async function runFileWrite(args: string[], options: { createOnly: boolean }): Promise<void> {
	const { positionals, flags } = parseArgs(args);
	const { row, name } = await resolveTaskFileTarget(positionals[0], positionals[1], "write");
	const content = await readContent(flags);
	const input = TaskWriteFileSchema.parse({ id: row.id, name, content });
	const project = await requireProject(row.project_id);

	if (
		options.createOnly &&
		(await taskFileExists({
			projectRoute: project.main_route,
			folderPath: row.folder_path,
			name: input.name,
		}))
	) {
		throw new Error(`Arquivo "${input.name}" já existe nesta tarefa`);
	}

	await writeTaskFile({
		projectRoute: project.main_route,
		folderPath: row.folder_path,
		name: input.name,
		content: input.content,
	});
	await notifyTasksChanged({ projectId: row.project_id, action: "updated", taskId: row.id });

	console.log(`✅ Arquivo "${input.name}" gravado em ${row.folder_path}.`);
}

async function runFileRename(args: string[]): Promise<void> {
	const { positionals } = parseArgs(args);
	const raw = positionals[0];
	const inferredName = inferTaskFileName(raw);
	const oldName = inferredName ? inferredName : positionals[1];
	const newName = inferredName ? positionals[1] : positionals[2];

	if (!oldName || !newName) {
		throw new Error(
			"Uso: kw-cli task file rename <taskId> <old.md> <new.md> ou kw-cli task file rename <arquivo.md> <new.md>",
		);
	}

	const row = await requireTask(raw);
	const input = TaskRenameFileSchema.parse({ id: row.id, oldName, newName });
	const project = await requireProject(row.project_id);

	await renameTaskFile({
		projectRoute: project.main_route,
		folderPath: row.folder_path,
		oldName: input.oldName,
		newName: input.newName,
	});

	const order = parseTaskFileOrder(row.file_order);
	const index = order.indexOf(input.oldName);
	if (index >= 0) {
		order[index] = input.newName;
		await dbTasks.update({ id: row.id, file_order: JSON.stringify(order) });
	}

	await notifyTasksChanged({ projectId: row.project_id, action: "updated", taskId: row.id });

	console.log(`✅ Arquivo "${input.oldName}" renomeado para "${input.newName}".`);
}

async function runFileRm(args: string[]): Promise<void> {
	const { row, name } = await resolveTaskFileTarget(args[0], args[1], "rm");
	const input = TaskDeleteFileSchema.parse({ id: row.id, name });
	const project = await requireProject(row.project_id);

	await deleteTaskFile({
		projectRoute: project.main_route,
		folderPath: row.folder_path,
		name: input.name,
	});

	const order = parseTaskFileOrder(row.file_order);
	const nextOrder = order.filter((fileName) => fileName !== input.name);
	if (nextOrder.length !== order.length) {
		await dbTasks.update({ id: row.id, file_order: JSON.stringify(nextOrder) });
	}

	await notifyTasksChanged({ projectId: row.project_id, action: "updated", taskId: row.id });

	console.log(`🗑️  Arquivo "${input.name}" removido.`);
}

async function runFileReorder(args: string[]): Promise<void> {
	const { positionals } = parseArgs(args);
	const raw = positionals[0];
	const orderedNames = positionals.slice(1);
	if (!raw || orderedNames.length === 0) {
		throw new Error("Uso: kw-cli task file reorder <taskId|caminho> <a.md> <b.md> [...]");
	}

	const row = await requireTask(raw);
	const input = TaskReorderFilesSchema.parse({ id: row.id, orderedNames });

	await dbTasks.update({ id: input.id, file_order: JSON.stringify(input.orderedNames) });
	await notifyTasksChanged({ projectId: row.project_id, action: "updated", taskId: row.id });

	console.log(`✅ Ordem dos arquivos atualizada: ${input.orderedNames.join(", ")}`);
}

async function runFileDate(args: string[]): Promise<void> {
	const { positionals, flags } = parseArgs(args);
	const { row, name } = await resolveTaskFileTarget(positionals[0], positionals[1], "date");
	const editedAt = parseEditedAt(flags["edited-at"] ?? flags.date);
	const input = TaskSetFileDateSchema.parse({ id: row.id, name, editedAt });
	const project = await requireProject(row.project_id);

	await setTaskFileEditedAt({
		projectRoute: project.main_route,
		folderPath: row.folder_path,
		name: input.name,
		editedAt: input.editedAt,
	});
	await notifyTasksChanged({ projectId: row.project_id, action: "updated", taskId: row.id });

	console.log(`✅ Data de "${input.name}" atualizada para ${formatInstant(input.editedAt)}.`);
}

async function resolveTaskFileTarget(
	raw: string | undefined,
	explicitName: string | undefined,
	command: string,
) {
	if (!raw) {
		throw new Error(`Uso: kw-cli task file ${command} <taskId|arquivo.md> [arquivo.md]`);
	}

	const row = await requireTask(raw);
	const inferredName = inferTaskFileName(raw);
	const name = explicitName ?? inferredName;

	if (!name) {
		throw new Error(`Informe o nome do arquivo .md da tarefa`);
	}

	return { row, name };
}

async function requireTask(raw: string | undefined) {
	if (!raw) {
		throw new Error("Informe a tarefa");
	}

	const row = await resolveTask(raw);
	if (!row) {
		throw new Error(`Nenhuma tarefa encontrada para ${raw}`);
	}

	return row;
}

async function requireProject(id: string) {
	const project = await dbProjects.getById(id);
	if (!project) {
		throw new Error(`Projeto não encontrado: ${id}`);
	}
	return project;
}

async function readContent(flags: Record<string, string>): Promise<string> {
	const stdin = hasFlag(flags, "stdin") || flags.from === "-";
	const fromFile = flags.from !== undefined && flags.from !== "-";
	const inline = flags.content !== undefined;
	const sources = [stdin, fromFile, inline].filter(Boolean);

	if (sources.length > 1) {
		throw new Error("Use apenas uma fonte de conteúdo: --content, --from ou --stdin.");
	}

	if (stdin) {
		return await Bun.stdin.text();
	}
	if (fromFile) {
		const path = flags.from;
		if (!path) {
			throw new Error("Informe um caminho em --from.");
		}
		return await Bun.file(path).text();
	}
	if (inline) {
		return flags.content;
	}
	return "";
}

function inferTaskFileName(raw: string | undefined): string | undefined {
	if (!raw) {
		return undefined;
	}

	const marker = ".koworker/";
	const normalized = raw.replaceAll("\\", "/");
	const index = normalized.indexOf(marker);
	if (index === -1) {
		return undefined;
	}

	const parts = normalized.slice(index + marker.length).split("/");
	if (parts.length !== 2) {
		return undefined;
	}

	const name = parts[1];
	if (!name.endsWith(".md")) {
		return undefined;
	}

	return name;
}

function parseEditedAt(raw: string | undefined): number {
	if (!raw) {
		throw new Error(
			"Uso: kw-cli task file date <taskId|arquivo.md> [arquivo.md] --edited-at <ISO|epoch-ms>",
		);
	}

	const numberValue = Number(raw);
	if (Number.isFinite(numberValue) && raw.trim() !== "") {
		return Math.trunc(numberValue);
	}

	const parsed = Date.parse(raw);
	if (Number.isNaN(parsed)) {
		throw new TypeError(`Data inválida: ${raw}`);
	}

	return parsed;
}

function formatInstant(value: number): string {
	if (!value) {
		return "-";
	}
	return new Date(normalizeEpochMs(value)).toISOString();
}

function normalizeEpochMs(value: number): number {
	if (value < 10_000_000_000) {
		return value * 1000;
	}
	return value;
}
