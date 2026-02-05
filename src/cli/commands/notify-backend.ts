type TaskNotifyAction = "created" | "updated" | "deleted";

type NotifyTaskChangeInput = {
	taskId: string;
	projectId: string;
	action: TaskNotifyAction;
};

const backendUrl =
	process.env.KOWORK_BACKEND_URL ?? process.env.KOWORK_API_URL ?? "http://localhost:3000";

export async function notifyTaskChange(input: NotifyTaskChangeInput) {
	try {
		const response = await fetch(new URL("/api/tasks/notify", backendUrl).href, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				task_id: input.taskId,
				project_id: input.projectId,
				action: input.action,
			}),
		});

		if (!response.ok) {
			console.warn(`Aviso: backend nao notificou evento da task (${response.status})`);
		}
	} catch (error) {
		console.warn(`Aviso: falha ao notificar backend da task: ${String(error)}`);
	}
}
