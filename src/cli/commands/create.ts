import { dbCategories } from "@/api/db/categories";
import { dbPriorities } from "@/api/db/priorities";
import { dbProjects } from "@/api/db/projects";
import { dbTasks } from "@/api/db/tasks";
import { buildFolderPath, createTaskFolder } from "@/api/helpers/task-folder";
import { parseArgs } from "../args";
import { notifyTasksChanged } from "../notify";
import { canonicalPath, resolveCategoryId, resolvePriorityId } from "../resolve";

// Resolve o projeto koworker cujo main_route é exatamente o cwd — o repositório onde o agente
// trabalha. Match exato (não por prefixo) de propósito: previsível e imune a um projeto com
// main_route raiz (`/`) que casaria com qualquer caminho.
async function resolveProjectByCwd() {
	const cwd = canonicalPath(process.cwd());
	const projects = await dbProjects.getAll();

	return projects.find((project) => canonicalPath(project.main_route) === cwd) ?? null;
}

async function defaultPriorityId(): Promise<string> {
	const priority = (await dbPriorities.getAll()).at(0);
	if (!priority) {
		throw new Error("O app precisa ter ao menos uma prioridade cadastrada.");
	}
	return priority.id;
}

async function defaultCategoryId(): Promise<string> {
	const category = (await dbCategories.getAll()).at(0);
	if (!category) {
		throw new Error("O app precisa ter ao menos uma categoria cadastrada.");
	}
	return category.id;
}

export async function runCreate(args: string[]): Promise<void> {
	const { positionals, flags } = parseArgs(args);
	// Título é opcional: sem args a task nasce sem nome e exibe o fallback do primeiro .md.
	const title = positionals.join(" ").trim() || undefined;

	const project = await resolveProjectByCwd();
	if (!project) {
		throw new Error(
			`Nenhum projeto koworker registrado para ${process.cwd()}. Cadastre o projeto no app (ou rode 'kowork project create') antes de criar tarefas.`,
		);
	}

	const [priorityId, categoryId] = await Promise.all([
		flags.priority ? resolvePriorityId(flags.priority) : defaultPriorityId(),
		flags.category ? resolveCategoryId(flags.category) : defaultCategoryId(),
	]);

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
	});

	await notifyTasksChanged({ projectId: project.id, action: "created", taskId: id });

	console.log(title ? `✅ Tarefa "${title}" criada.` : "✅ Tarefa criada.");
	console.log(`taskId: ${id}`);
	console.log(folderPath);
}
