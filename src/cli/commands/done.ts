import { dbTasks } from "@/api/db/tasks";

// Extrai o `folder_path` canônico (".koworker/<dir>") de um caminho qualquer dentro
// da pasta da tarefa — absoluto, relativo, ou apontando para um arquivo dela.
function resolveFolderPath(input: string): string | null {
	const marker = ".koworker/";
	const normalized = input.replaceAll("\\", "/");
	const idx = normalized.indexOf(marker);
	if (idx === -1) return null;

	const dir = normalized.slice(idx + marker.length).split("/")[0];
	if (!dir) return null;

	return `.koworker/${dir}`;
}

export async function runDone(args: string[]): Promise<void> {
	const raw = args[0];
	if (!raw) {
		console.error("Uso: kowork done <caminho-da-pasta>");
		process.exit(1);
	}

	const folderPath = resolveFolderPath(raw);
	if (!folderPath) {
		console.error(`Caminho inválido: ${raw} (esperado um caminho dentro de .koworker/)`);
		process.exit(1);
	}

	const row = await dbTasks.getByFolderPath(folderPath);
	if (!row) {
		console.error(`Nenhuma tarefa encontrada para ${folderPath}`);
		process.exit(1);
	}

	await dbTasks.update({ id: row.id, done: 1, completed_at: Date.now() });
	console.log(`✅ Tarefa "${row.title ?? folderPath}" marcada como concluída.`);
}
