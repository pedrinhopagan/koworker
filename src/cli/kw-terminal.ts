import { spawn } from "node:child_process";

import { taskFeatureRouteId } from "@/routes/_app/tarefas/-utils/task-route-resolution";

// O kw-terminal injeta o id do pane no ambiente do agente. Sem ele a CLI não
// está rodando dentro de um pane e não há sessão para vincular.
const PANE_ID_ENV_VAR = "HERDR_PANE_ID";
const KW_TERMINAL_BIN = "kw-terminal";

export type SessionTask = {
	id: string;
	title: string | null | undefined;
	groupId: string | null | undefined;
	file?: string;
};

// A tarefa que este comando tocou, ou `null` quando ele desfez o vínculo.
// `undefined` é o comando que não mira tarefa nenhuma e não deve mexer na barra.
let pendingTask: SessionTask | null | undefined;

export function noteSessionTask(task: SessionTask): void {
	pendingTask = task;
}

export function clearSessionTask(): void {
	pendingTask = null;
}

export function sessionTaskArgs(task: SessionTask): string[] {
	const route = `/tarefas/${taskFeatureRouteId(task.groupId)}/${task.id}`;

	return [
		"--task-id",
		task.id,
		"--title",
		task.title?.trim() || "Sem título",
		"--route",
		route,
		...(task.file ? ["--file-route", `${route}/${encodeURIComponent(task.file)}`] : []),
	];
}

// Vincular a sessão é um efeito colateral de conveniência: o kw-terminal pode
// estar fechado, desatualizado ou fora do PATH, e nada disso pode derrubar a
// escrita que a CLI acabou de fazer. Por isso o processo é solto e mudo.
export function flushSessionTask(): void {
	if (pendingTask === undefined) {
		return;
	}

	const paneId = process.env[PANE_ID_ENV_VAR]?.trim();
	if (!paneId) {
		return;
	}

	const args = pendingTask === null ? ["--clear"] : sessionTaskArgs(pendingTask);
	pendingTask = undefined;

	try {
		spawn(
			process.env.KW_TERMINAL_BIN ?? KW_TERMINAL_BIN,
			["pane", "report-task", paneId, ...args],
			{
				detached: true,
				stdio: "ignore",
			},
		).unref();
	} catch {
		// kw-terminal ausente do PATH: a tarefa segue gravada, só não aparece na barra.
	}
}
