import { DEFAULT_KOWORK_PORT, KOWORK_PROD_PORT } from "@/lib/runtime-config";

// A UI só atualiza ao vivo pelo PubSub in-process do servidor. A CLI é outro processo, então
// avisa o servidor por HTTP — best-effort: se o app estiver fechado, o POST falha em silêncio e
// a escrita no banco permanece. Tenta as portas de dev e prod (e KOWORK_PORT, se setado).
export async function notifyTasksChanged(input: {
	projectId: string;
	action: "created" | "updated" | "deleted";
	taskId?: string;
}): Promise<void> {
	const ports = new Set<number>([DEFAULT_KOWORK_PORT, KOWORK_PROD_PORT]);
	if (process.env.KOWORK_PORT) {
		ports.add(Number(process.env.KOWORK_PORT));
	}

	const body = JSON.stringify({
		project_id: input.projectId,
		task_id: input.taskId,
		action: input.action,
	});

	await Promise.all(
		[...ports].map((port) =>
			fetch(`http://localhost:${port}/api/tasks/notify`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body,
			}).catch(() => {}),
		),
	);
}
