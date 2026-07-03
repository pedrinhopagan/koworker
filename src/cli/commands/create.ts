import { dbTasks } from "@/api/db/tasks";
import { buildFolderPath, createTaskFolder } from "@/api/helpers/task-folder";
import { parseArgs } from "../args";
import { notifyTasksChanged } from "../notify";
import {
	resolveCategoryId,
	resolveComplexity,
	resolvePriorityId,
	resolveProjectByCwd,
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

	// Prioridade e categoria são opcionais: sem a flag, a task nasce sem nenhuma delas (null).
	const category = flags.category ?? flags.type;
	const [priorityId, categoryId] = await Promise.all([
		flags.priority ? resolvePriorityId(flags.priority) : undefined,
		category ? resolveCategoryId(category) : undefined,
	]);
	const complexity = flags.complexity ? resolveComplexity(flags.complexity) : "medio";

	const id = crypto.randomUUID();
	const folderPath = buildFolderPath(id);

	await createTaskFolder({ projectRoute: project.main_route, folderPath, title });
	await dbTasks.create({
		id,
		project_id: project.id,
		folder_path: folderPath,
		title,
		priority_id: priorityId,
		category_id: categoryId,
		complexity,
	});

	await notifyTasksChanged({ projectId: project.id, action: "created", taskId: id });

	console.log(title ? `✅ Tarefa "${title}" criada.` : "✅ Tarefa criada.");
	console.log(`taskId: ${id}`);
	console.log(folderPath);
}
