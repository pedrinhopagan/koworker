import { dbTasks } from "@/api/db/tasks";
import { notifyTasksChanged } from "../notify";
import { resolveTask } from "../resolve";

export async function runDone(args: string[]): Promise<void> {
	const raw = args[0];
	if (!raw) {
		throw new Error("Uso: kowork done <taskId|caminho>");
	}

	const row = await resolveTask(raw);
	if (!row) {
		throw new Error(`Nenhuma tarefa encontrada para ${raw}`);
	}

	await dbTasks.update({ id: row.id, done: 1, completed_at: Date.now() });
	await notifyTasksChanged({ projectId: row.project_id, action: "updated", taskId: row.id });

	console.log(`✅ Tarefa "${row.title ?? row.folder_path}" marcada como concluída.`);
}
