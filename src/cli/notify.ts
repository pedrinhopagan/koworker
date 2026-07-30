import { DEFAULT_KOWORK_PORT, KOWORK_PROD_PORT } from "@/lib/runtime-config";

// A UI só atualiza ao vivo pelo PubSub in-process do servidor. A CLI é outro processo, então
// avisa o servidor por HTTP — best-effort: se o app estiver fechado, o POST falha em silêncio e
// a escrita no banco permanece. Tenta as portas de dev e prod (e KOWORK_PORT, se setado).
// O aviso tem teto de tempo: um servidor no ar mas sem responder (event loop saturado) não pode
// pendurar a CLI, que é o canal usado pelo agente dentro de uma execução.
const NOTIFY_TIMEOUT_MS = 1500;

// Retorna quantas portas confirmaram o POST, para quem precisa distinguir
// "servidor fora do ar" de "servidor recebeu". A confirmação é o `{ok:true}` do
// corpo, não o status: em dev o fallback SPA responde 200 para rota inexistente.
export async function postToServer(path: string, payload: object): Promise<number> {
	const ports = new Set<number>([DEFAULT_KOWORK_PORT, KOWORK_PROD_PORT]);
	if (process.env.KOWORK_PORT) {
		ports.add(Number(process.env.KOWORK_PORT));
	}

	const headers: Record<string, string> = { "Content-Type": "application/json" };
	const notifyToken = process.env.KOWORK_NOTIFY_TOKEN;
	if (notifyToken) {
		headers.Authorization = `Bearer ${notifyToken}`;
	}

	const acknowledged = await Promise.all(
		[...ports].map(async (port) => {
			const response = await fetch(`http://localhost:${port}${path}`, {
				method: "POST",
				headers,
				body: JSON.stringify(payload),
				signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
			}).catch(() => null);
			if (!response?.ok) {
				return false;
			}

			const body = await response.json().catch(() => null);

			return (body as { ok?: boolean } | null)?.ok === true;
		}),
	);

	return acknowledged.filter(Boolean).length;
}

export async function notifyTasksChanged(input: {
	projectId: string;
	action: "created" | "updated" | "deleted";
	taskId?: string;
}): Promise<void> {
	await postToServer("/api/tasks/notify", {
		project_id: input.projectId,
		task_id: input.taskId,
		action: input.action,
	});
}
