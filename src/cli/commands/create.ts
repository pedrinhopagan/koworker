import { createTaskStorage } from "@/api/helpers/task-creation";
import { parseArgs } from "../args";
import { notifyTasksChanged } from "../notify";
import {
	resolveCategoryId,
	resolveComplexity,
	resolvePriorityId,
	resolveProjectByCwd,
	resolveTaskGroupId,
} from "../resolve";

export async function runCreate(args: string[]): Promise<void> {
	const { positionals, flags } = parseArgs(args);
	// Título é opcional: sem args a task nasce sem nome e exibe o fallback do primeiro .md.
	const title = positionals.join(" ").trim() || undefined;

	const project = await resolveProjectByCwd();
	if (!project) {
		throw new Error(
			`Nenhum projeto koworker registrado para ${process.cwd()}. Cadastre o projeto no app (ou rode 'kw-cli project create') antes de criar tarefas.`,
		);
	}
	if (!flags.feature?.trim()) {
		throw new Error(
			"Toda tarefa criada pela CLI precisa de uma feature. Use 'kw-cli feature list' ou crie uma com 'kw-cli feature create <nome>', então passe --feature <nome|id>.",
		);
	}

	// Prioridade e categoria são opcionais: sem a flag, a task nasce sem nenhuma delas (null).
	const category = flags.category ?? flags.type;
	const [priorityId, categoryId, groupId] = await Promise.all([
		flags.priority ? resolvePriorityId(flags.priority) : undefined,
		category ? resolveCategoryId(category) : undefined,
		resolveTaskGroupId(flags.feature, project.id),
	]);
	const complexity = flags.complexity ? resolveComplexity(flags.complexity) : "medio";

	const task = await createTaskStorage({
		projectId: project.id,
		title,
		priorityId,
		categoryId,
		complexity,
		groupId,
		seed: true,
	});
	if (!task) {
		throw new Error("Tarefa não encontrada após a criação");
	}

	await notifyTasksChanged({ projectId: project.id, action: "created", taskId: task.id });

	console.log(title ? `✅ Tarefa "${title}" criada.` : "✅ Tarefa criada.");
	console.log(`taskId: ${task.id}`);
	console.log(task.folder_path);
}
