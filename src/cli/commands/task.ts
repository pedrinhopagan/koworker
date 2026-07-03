import { dbProjects } from "@/api/db/projects";
import { dbTasks } from "@/api/db/tasks";
import type { TaskDbUpdateInput } from "@/api/schemas/tasks";
import { removeTaskFolder } from "@/api/helpers/task-folder";
import { parseArgs } from "../args";
import { notifyTasksChanged } from "../notify";
import { resolveCategoryId, resolveComplexity, resolvePriorityId, resolveTask } from "../resolve";

export function runTask(args: string[]): Promise<void> {
	const [sub, ...rest] = args;

	if (sub === "set") {
		return runTaskSet(rest);
	}
	if (sub === "rm") {
		return runTaskRm(rest);
	}

	throw new Error(`Subcomando desconhecido: task ${sub ?? ""}. Use: task set | task rm`);
}

async function runTaskSet(args: string[]): Promise<void> {
	const { positionals, flags } = parseArgs(args);
	const raw = positionals[0];
	if (!raw) {
		throw new Error(
			"Uso: kw-cli task set <taskId|caminho> [--title ...] [--category <nome|id>] [--priority <nome|id>] [--complexity <simples|medio|complexo|extremo>]",
		);
	}

	const row = await resolveTask(raw);
	if (!row) {
		throw new Error(`Nenhuma tarefa encontrada para ${raw}`);
	}

	const update: { id: string } & TaskDbUpdateInput = { id: row.id };

	// Título vazio limpa o nome e devolve a task pro fallback do primeiro .md (o schema trata null).
	if (flags.title !== undefined) {
		update.title = flags.title.trim() === "" ? null : flags.title.trim();
	}
	if (flags.category !== undefined) {
		update.category_id = await resolveCategoryId(flags.category);
	}
	if (flags.priority !== undefined) {
		update.priority_id = await resolvePriorityId(flags.priority);
	}
	if (flags.complexity !== undefined) {
		update.complexity = resolveComplexity(flags.complexity);
	}

	await dbTasks.update(update);
	await notifyTasksChanged({ projectId: row.project_id, action: "updated", taskId: row.id });

	console.log(`✅ Tarefa "${update.title ?? row.title ?? row.folder_path}" atualizada.`);
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
