import { dbCategories } from "@/api/db/categories";
import { dbPriorities } from "@/api/db/priorities";
import { dbProjects } from "@/api/db/projects";
import { dbTasks } from "@/api/db/tasks";
import type { TaskDbUpdateInput } from "@/api/schemas/tasks";
import { parseTaskFileOrder, readTaskFiles, removeTaskFolder } from "@/api/helpers/task-folder";
import { COMPLEXITY_LABELS, TASK_COMPLEXITIES } from "@/constants/complexity";
import { hasFlag, parseArgs } from "../args";
import { notifyTasksChanged } from "../notify";
import {
	resolveCategoryId,
	resolveCategoryIdOrNull,
	resolveComplexity,
	resolvePriorityId,
	resolvePriorityIdOrNull,
	resolveProjectByCwd,
	resolveTask,
} from "../resolve";
import { runCreate } from "./create";
import { runTaskFile } from "./task-file";

export function runTask(args: string[]): Promise<void> {
	const [sub, ...rest] = args;

	if (sub === "create" || sub === "new") {
		return runCreate(rest);
	}
	if (sub === "list" || sub === "ls") {
		return runTaskList(rest);
	}
	if (sub === "show" || sub === "get") {
		return runTaskShow(rest);
	}
	if (sub === "set" || sub === "update") {
		return runTaskSet(rest);
	}
	if (sub === "done") {
		return setTaskDone(rest[0], true);
	}
	if (sub === "reopen" || sub === "open") {
		return setTaskDone(rest[0], false);
	}
	if (sub === "rm" || sub === "delete") {
		return runTaskRm(rest);
	}
	if (sub === "file" || sub === "files") {
		return runTaskFile(rest);
	}
	if (sub === "options") {
		return runTaskOptions();
	}

	throw new Error(
		`Subcomando desconhecido: task ${sub ?? ""}. Use: create | list | show | set | done | reopen | rm | file | options`,
	);
}

async function runTaskList(args: string[]): Promise<void> {
	const { positionals, flags } = parseArgs(args);
	const projectId = await resolveProjectFilter(flags);
	const category = flags.category ?? flags.type;
	const status = resolveStatusFilter(flags);
	const positionalQ = positionals.join(" ").trim();
	const q = flags.q ?? (positionalQ || undefined);
	const [categoryId, priorityId] = await Promise.all([
		category ? resolveCategoryId(category) : undefined,
		flags.priority ? resolvePriorityId(flags.priority) : undefined,
	]);
	const rows = await dbTasks.listForCli({
		projectId,
		includeCompleted: hasFlag(flags, "all") || hasFlag(flags, "include-done") || status === true,
		done: status,
		taskTypeId: categoryId,
		priorityId,
		complexity: flags.complexity ? resolveComplexity(flags.complexity) : undefined,
		q,
	});

	if (rows.length === 0) {
		console.log("Nenhuma tarefa encontrada.");
		return;
	}

	console.log("id\tstatus\tcomplexidade\tprioridade\ttipo\tprojeto\tpasta\ttítulo");
	for (const row of rows) {
		console.log(
			[
				row.id,
				formatStatus(row.done),
				formatComplexity(row.complexity),
				formatOptional(row.priority_name),
				formatOptional(row.category_name),
				row.project_name,
				row.folder_path,
				row.title ?? "Sem título",
			].join("\t"),
		);
	}
}

async function runTaskShow(args: string[]): Promise<void> {
	const raw = args[0];
	if (!raw) {
		throw new Error("Uso: kw-cli task show <taskId|caminho>");
	}

	const row = await resolveTask(raw);
	if (!row) {
		throw new Error(`Nenhuma tarefa encontrada para ${raw}`);
	}

	const details = (await dbTasks.listForCli({ id: row.id, includeCompleted: true })).at(0);
	const project = details ? null : await dbProjects.getById(row.project_id);
	const projectRoute = details?.project_main_route ?? project?.main_route;
	if (!projectRoute) {
		throw new Error(`Projeto não encontrado: ${row.project_id}`);
	}

	const { files, primaryFile } = await readTaskFiles({
		projectRoute,
		folderPath: row.folder_path,
		order: parseTaskFileOrder(row.file_order),
	});

	console.log(`id: ${row.id}`);
	console.log(`título: ${row.title ?? "Sem título"}`);
	console.log(`status: ${formatStatus(row.done)}`);
	console.log(`complexidade: ${formatComplexity(row.complexity)}`);
	console.log(`prioridade: ${formatOptional(details?.priority_name)}`);
	console.log(`tipo: ${formatOptional(details?.category_name)}`);
	console.log(`projeto: ${details?.project_name ?? project?.name ?? row.project_id}`);
	console.log(`pasta: ${row.folder_path}`);
	console.log(`criada: ${formatInstant(row.created_at)}`);
	console.log(`atualizada: ${formatInstant(row.updated_at)}`);
	console.log(`concluída: ${formatInstant(row.completed_at)}`);
	console.log(`arquivo primário: ${primaryFile ?? "-"}`);

	if (files.length === 0) {
		console.log("arquivos: nenhum");
		return;
	}

	console.log("arquivos:");
	for (const file of files) {
		console.log(`- ${file.name}\t${file.content.length} chars\t${formatInstant(file.editedAt)}`);
	}
}

async function runTaskSet(args: string[]): Promise<void> {
	const { positionals, flags } = parseArgs(args);
	const raw = positionals[0];
	if (!raw) {
		throw new Error(
			"Uso: kw-cli task set <taskId|caminho> [--title ...] [--type <nome|id>] [--priority <nome|id>] [--complexity <simples|medio|complexo|extremo>] [--done|--pending]",
		);
	}

	const row = await resolveTask(raw);
	if (!row) {
		throw new Error(`Nenhuma tarefa encontrada para ${raw}`);
	}

	const update: { id: string } & TaskDbUpdateInput = { id: row.id };
	const category = flags.category ?? flags.type;

	if (flags.title !== undefined) {
		update.title = flags.title.trim() === "" ? null : flags.title.trim();
	}
	if (category !== undefined) {
		update.category_id = await resolveCategoryIdOrNull(category);
	}
	if (flags.priority !== undefined) {
		update.priority_id = await resolvePriorityIdOrNull(flags.priority);
	}
	if (flags.complexity !== undefined) {
		update.complexity = resolveComplexity(flags.complexity);
	}
	if (hasFlag(flags, "done") && hasFlag(flags, "pending")) {
		throw new Error("Use apenas um status: --done ou --pending.");
	}
	if (hasFlag(flags, "done")) {
		update.done = 1;
		update.completed_at = Date.now();
	}
	if (hasFlag(flags, "pending")) {
		update.done = 0;
		update.completed_at = null;
	}
	if (Object.keys(update).length === 1) {
		throw new Error("Informe ao menos um campo para atualizar.");
	}

	await dbTasks.update(update);
	await notifyTasksChanged({ projectId: row.project_id, action: "updated", taskId: row.id });

	console.log(`✅ Tarefa "${update.title ?? row.title ?? row.folder_path}" atualizada.`);
}

export async function setTaskDone(raw: string | undefined, done: boolean): Promise<void> {
	if (!raw) {
		throw new Error(
			done ? "Uso: kw-cli task done <taskId|caminho>" : "Uso: kw-cli task reopen <taskId|caminho>",
		);
	}

	const row = await resolveTask(raw);
	if (!row) {
		throw new Error(`Nenhuma tarefa encontrada para ${raw}`);
	}

	await dbTasks.update({ id: row.id, done: done ? 1 : 0, completed_at: done ? Date.now() : null });
	await notifyTasksChanged({ projectId: row.project_id, action: "updated", taskId: row.id });

	console.log(
		done
			? `✅ Tarefa "${row.title ?? row.folder_path}" marcada como concluída.`
			: `✅ Tarefa "${row.title ?? row.folder_path}" reaberta.`,
	);
}

async function runTaskRm(args: string[]): Promise<void> {
	const raw = args[0];
	if (!raw) {
		throw new Error("Uso: kw-cli task rm <taskId|caminho>");
	}

	const row = await resolveTask(raw);
	if (!row) {
		throw new Error(`Nenhuma tarefa encontrada para ${raw}`);
	}

	const project = await dbProjects.getById(row.project_id);

	await dbTasks.softDelete(row.id);
	if (project) {
		await removeTaskFolder({ projectRoute: project.main_route, folderPath: row.folder_path });
	}
	await notifyTasksChanged({ projectId: row.project_id, action: "deleted", taskId: row.id });

	console.log(`🗑️  Tarefa "${row.title ?? row.folder_path}" removida.`);
}

async function runTaskOptions(): Promise<void> {
	const [categories, priorities] = await Promise.all([
		dbCategories.getAll(),
		dbPriorities.getAll(),
	]);

	console.log("complexidades");
	for (const complexity of TASK_COMPLEXITIES) {
		console.log(`${complexity}\t${COMPLEXITY_LABELS[complexity]}`);
	}

	console.log("tipos");
	for (const category of categories) {
		console.log(`${category.id}\t${category.name}\t${category.color}`);
	}

	console.log("prioridades");
	for (const priority of priorities) {
		console.log(`${priority.id}\t${priority.name}\t${priority.color}`);
	}
}

async function resolveProjectFilter(flags: Record<string, string>): Promise<string | null> {
	if (hasFlag(flags, "all-projects") && flags.project !== undefined) {
		throw new Error("Use --all-projects ou --project, não ambos.");
	}

	if (hasFlag(flags, "all-projects")) {
		return null;
	}

	if (flags.project !== undefined) {
		const projectId = flags.project.trim();
		if (!projectId) {
			throw new Error("Informe um projeto válido em --project.");
		}
		if (projectId === "all") {
			return null;
		}

		const project = await dbProjects.getById(projectId);
		if (!project) {
			throw new Error(`Projeto não encontrado: ${projectId}`);
		}
		return project.id;
	}

	const project = await resolveProjectByCwd();
	if (!project) {
		throw new Error(
			`Nenhum projeto koworker registrado para ${process.cwd()}. Use --all-projects ou rode 'kw-cli project create'.`,
		);
	}

	return project.id;
}

function resolveStatusFilter(flags: Record<string, string>): boolean | undefined {
	if (hasFlag(flags, "done") && hasFlag(flags, "pending")) {
		throw new Error("Use apenas um filtro de status: --done ou --pending.");
	}
	if (hasFlag(flags, "done")) {
		return true;
	}
	if (hasFlag(flags, "pending")) {
		return false;
	}
	return undefined;
}

function formatStatus(value: number | null | undefined): string {
	return value ? "concluída" : "pendente";
}

function formatComplexity(value: string | null | undefined): string {
	if (value && value in COMPLEXITY_LABELS) {
		return COMPLEXITY_LABELS[value as keyof typeof COMPLEXITY_LABELS];
	}
	return value ?? "-";
}

function formatOptional(value: string | null | undefined): string {
	return value ?? "-";
}

function formatInstant(value: number | null | undefined): string {
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
