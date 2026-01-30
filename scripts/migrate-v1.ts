import Database from "bun:sqlite";
import { db } from "../src/api/db/connection";

const v1DbPath = `${process.env.HOME}/.local/share/workopilot/workopilot.db`;
const v1Db = new Database(v1DbPath, { readonly: true });

const categoryMap: Record<string, string> = {
	feature: "",
	fix: "",
	bug: "",
	refactor: "",
	test: "",
	doc: "",
};

const priorityMap: Record<number, string> = {
	1: "",
	2: "",
	3: "",
};

const statusMap: Record<string, string> = {
	pending: "pending",
	in_progress: "in_execution",
	review: "in_execution",
	done: "executed",
	cancelled: "executed",
};

async function migrate() {
	console.log("Iniciando migração v1 -> v2...\n");

	const existingCategories = await db.selectFrom("categories").select(["id", "name"]).execute();

	for (const cat of existingCategories) {
		const normalizedName = cat.name.toLowerCase();
		categoryMap[normalizedName] = cat.id;
		if (normalizedName === "fix") {
			categoryMap.bug = cat.id;
			categoryMap.refactor = cat.id;
		}
	}

	const existingPriorities = await db.selectFrom("priorities").select(["id", "name"]).execute();

	for (const pri of existingPriorities) {
		const name = pri.name.toLowerCase();
		if (name === "alta") priorityMap[1] = pri.id;
		if (name === "media") priorityMap[2] = pri.id;
		if (name === "baixa") priorityMap[3] = pri.id;
	}

	console.log("Mapeamento de categorias:", categoryMap);
	console.log("Mapeamento de prioridades:", priorityMap);

	const v1Projects = v1Db
		.query<
			{
				id: string;
				name: string;
				path: string;
				description: string | null;
				color: string | null;
				created_at: string;
			},
			[]
		>("SELECT id, name, path, description, color, created_at FROM projects")
		.all();

	console.log(`\nMigrando ${v1Projects.length} projetos...`);

	for (const project of v1Projects) {
		const exists = await db
			.selectFrom("projects")
			.select("id")
			.where("id", "=", project.id)
			.executeTakeFirst();

		if (exists) {
			console.log(`  Projeto "${project.name}" já existe, pulando...`);
			continue;
		}

		await db
			.insertInto("projects")
			.values({
				id: project.id,
				name: project.name,
				main_route: project.path,
				description: project.description ?? undefined,
				color: project.color ?? "#10B981",
				created_at: new Date(project.created_at).getTime(),
			})
			.execute();

		console.log(`  Projeto "${project.name}" migrado.`);
	}

	const v1Tasks = v1Db
		.query<
			{
				id: string;
				project_id: string;
				title: string;
				description: string | null;
				category: string;
				priority: number;
				status: string;
				created_at: string;
				completed_at: string | null;
				acceptance_criteria: string | null;
				ai_metadata: string | null;
			},
			[]
		>(
			`SELECT id, project_id, title, description, category, priority, status, 
       created_at, completed_at, acceptance_criteria, ai_metadata FROM tasks`,
		)
		.all();

	console.log(`\nMigrando ${v1Tasks.length} tarefas...`);

	let tasksMigrated = 0;
	let tasksSkipped = 0;

	for (const task of v1Tasks) {
		const exists = await db
			.selectFrom("tasks")
			.select("id")
			.where("id", "=", task.id)
			.executeTakeFirst();

		if (exists) {
			tasksSkipped++;
			continue;
		}

		const projectExists = await db
			.selectFrom("projects")
			.select("id")
			.where("id", "=", task.project_id)
			.executeTakeFirst();

		if (!projectExists) {
			console.log(`  Tarefa "${task.title}" ignorada: projeto não existe.`);
			tasksSkipped++;
			continue;
		}

		const catKey = task.category.toLowerCase();
		const categoryId = categoryMap[catKey] || categoryMap.feature;
		const priorityId = priorityMap[task.priority] || priorityMap[2];

		if (!categoryId || !priorityId) {
			console.log(`  Tarefa "${task.title}" ignorada: categoria/prioridade inválida.`);
			tasksSkipped++;
			continue;
		}

		await db
			.insertInto("tasks")
			.values({
				id: task.id,
				project_id: task.project_id,
				title: task.title,
				description: task.description ?? undefined,
				category_id: categoryId,
				priority_id: priorityId,
				status: statusMap[task.status] || "pending",
				created_at: new Date(task.created_at).getTime(),
				completed_at: task.completed_at ? new Date(task.completed_at).getTime() : undefined,
				acceptance_criteria: task.acceptance_criteria ?? undefined,
				ai_metadata: task.ai_metadata ?? undefined,
			})
			.execute();

		tasksMigrated++;
	}

	console.log(`  ${tasksMigrated} tarefas migradas, ${tasksSkipped} puladas.`);

	const v1Subtasks = v1Db
		.query<
			{
				id: string;
				task_id: string;
				title: string;
				description: string | null;
				status: string;
				created_at: string;
				completed_at: string | null;
			},
			[]
		>(`SELECT id, task_id, title, description, status, created_at, completed_at FROM subtasks`)
		.all();

	console.log(`\nMigrando ${v1Subtasks.length} subtarefas...`);

	let subtasksMigrated = 0;
	let subtasksSkipped = 0;

	for (const subtask of v1Subtasks) {
		const exists = await db
			.selectFrom("subtasks")
			.select("id")
			.where("id", "=", subtask.id)
			.executeTakeFirst();

		if (exists) {
			subtasksSkipped++;
			continue;
		}

		const taskExists = await db
			.selectFrom("tasks")
			.select("id")
			.where("id", "=", subtask.task_id)
			.executeTakeFirst();

		if (!taskExists) {
			subtasksSkipped++;
			continue;
		}

		await db
			.insertInto("subtasks")
			.values({
				id: subtask.id,
				task_id: subtask.task_id,
				title: subtask.title,
				description: subtask.description ?? undefined,
				status: statusMap[subtask.status] || "pending",
				created_at: new Date(subtask.created_at).getTime(),
				completed_at: subtask.completed_at ? new Date(subtask.completed_at).getTime() : undefined,
			})
			.execute();

		subtasksMigrated++;
	}

	console.log(`  ${subtasksMigrated} subtarefas migradas, ${subtasksSkipped} puladas.`);

	console.log("\nMigração concluída!");
}

await migrate();
