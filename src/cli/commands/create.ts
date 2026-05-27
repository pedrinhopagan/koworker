import { realpathSync } from "node:fs";

import { dbCategories } from "@/api/db/categories";
import { dbPriorities } from "@/api/db/priorities";
import { dbProjects } from "@/api/db/projects";
import { dbTasks } from "@/api/db/tasks";
import { buildFolderPath, createTaskFolder } from "@/api/helpers/task-folder";

// Caminho real e normalizado: resolve symlinks (o `main_route` pode ter sido cadastrado
// por um symlink que o `process.cwd()` já entrega resolvido) e tira a barra final.
function canonicalPath(path: string): string {
	const normalized = path.replaceAll("\\", "/").replace(/\/$/, "");
	try {
		return realpathSync(normalized);
	} catch {
		return normalized;
	}
}

// Resolve o projeto koworker cujo `main_route` é exatamente o cwd — o repositório onde o
// agente trabalha. Match exato (e não por prefixo) de propósito: previsível e imune a um
// projeto com `main_route` raiz (`/`) que casaria com qualquer caminho.
async function resolveProjectByCwd() {
	const cwd = canonicalPath(process.cwd());
	const projects = await dbProjects.getAll();

	return projects.find((project) => canonicalPath(project.main_route) === cwd) ?? null;
}

export async function runCreate(args: string[]): Promise<void> {
	// Título é opcional: sem args a task nasce sem nome e exibe o fallback do primeiro .md.
	const title = args.join(" ").trim() || undefined;

	const project = await resolveProjectByCwd();
	if (!project) {
		console.error(
			`Nenhum projeto koworker registrado para ${process.cwd()}. Cadastre o projeto no app antes de criar tarefas.`,
		);
		process.exit(1);
	}

	const [priorities, categories] = await Promise.all([
		dbPriorities.getAll(),
		dbCategories.getAll(),
	]);
	const priority = priorities.at(0);
	const category = categories.at(0);
	if (!priority || !category) {
		console.error("O app precisa ter ao menos uma prioridade e uma categoria cadastradas.");
		process.exit(1);
	}

	const id = crypto.randomUUID();
	const folderPath = buildFolderPath(id);

	await createTaskFolder({ projectRoute: project.main_route, folderPath, title });
	await dbTasks.create({
		id,
		project_id: project.id,
		folder_path: folderPath,
		title,
		priority_id: priority.id,
		category_id: category.id,
	});

	console.log(title ? `✅ Tarefa "${title}" criada.` : "✅ Tarefa criada.");
	console.log(folderPath);
}
