import { toast } from "sonner";

import {
	isTauri,
	type OpenTerminalResult,
	openTerminalForTask,
	closeProjectSession as tauriCloseProjectSession,
	closeTaskWindow as tauriCloseTaskWindow,
} from "./tauri";

const DEFAULT_MODEL = "anthropic/claude-sonnet-4-20250514";

export type ProjectInfo = {
	id: string;
	name: string;
	mainRoute: string;
};

export type TaskInfo = {
	id: string;
	title: string;
};

export type TerminalResult = {
	success: boolean;
	message: string;
	result?: OpenTerminalResult;
};

type OpenTerminalOptions = {
	showToast?: boolean;
};

/**
 * Abre ou foca no terminal de um projeto.
 * Se não existir sessão, cria uma nova.
 * Se existir, foca na janela existente.
 */
export async function openProjectTerminal(
	project: ProjectInfo,
	options: OpenTerminalOptions = {},
): Promise<TerminalResult> {
	const { showToast = true } = options;

	if (!isTauri()) {
		const message = "Terminal disponível apenas no app desktop";
		if (showToast) toast.warning(message);
		return { success: false, message };
	}

	try {
		const result = await openTerminalForTask({
			projectId: project.id,
			projectName: project.name,
			mainRoute: project.mainRoute,
			taskId: `project_${project.id.slice(0, 8)}`,
			taskTitle: project.name,
			model: DEFAULT_MODEL,
		});

		if (!result) {
			const message = "Falha ao abrir terminal";
			if (showToast) toast.error(message);
			return { success: false, message };
		}

		const message = result.isNewSession
			? `Terminal aberto para ${project.name}`
			: "Terminal focado";

		if (showToast) toast.success(message);
		return { success: true, message, result };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Erro ao abrir terminal";
		if (showToast) toast.error(message);
		return { success: false, message };
	}
}

/**
 * Abre terminal para executar uma tarefa específica.
 * Cria uma nova tab/window para a tarefa dentro da sessão do projeto.
 */
export async function openTaskTerminal(
	project: ProjectInfo,
	task: TaskInfo,
	options: OpenTerminalOptions = {},
): Promise<TerminalResult> {
	const { showToast = true } = options;

	if (!isTauri()) {
		const message = "Terminal disponível apenas no app desktop";
		if (showToast) toast.warning(message);
		return { success: false, message };
	}

	try {
		const result = await openTerminalForTask({
			projectId: project.id,
			projectName: project.name,
			mainRoute: project.mainRoute,
			taskId: task.id,
			taskTitle: task.title,
			model: DEFAULT_MODEL,
		});

		if (!result) {
			const message = "Falha ao abrir terminal";
			if (showToast) toast.error(message);
			return { success: false, message };
		}

		let message: string;
		if (result.isNewSession) {
			message = `Terminal aberto para ${project.name}`;
		} else if (result.isNewWindow) {
			message = `Nova tab: ${task.title}`;
		} else {
			message = `Focando em ${task.title}`;
		}

		if (showToast) toast.success(message);
		return { success: true, message, result };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Erro ao abrir terminal";
		if (showToast) toast.error(message);
		return { success: false, message };
	}
}

/**
 * Executa um comando/prompt no terminal de uma tarefa.
 * Abre o terminal se necessário e envia o comando para execução.
 */
export async function executeInTerminal(
	project: ProjectInfo,
	task: TaskInfo,
	prompt: string,
	model: string = DEFAULT_MODEL,
	options: OpenTerminalOptions = {},
): Promise<TerminalResult> {
	const { showToast = true } = options;

	if (!isTauri()) {
		console.log("=".repeat(60));
		console.log("[Terminal] Modo browser - prompt:");
		console.log(prompt);
		console.log("=".repeat(60));

		const message = "Modo browser: prompt logado no console";
		if (showToast) toast.info(message);
		return { success: true, message };
	}

	try {
		const result = await openTerminalForTask({
			projectId: project.id,
			projectName: project.name,
			mainRoute: project.mainRoute,
			taskId: task.id,
			taskTitle: task.title,
			model,
			prompt,
		});

		if (!result) {
			const message = "Falha ao executar no terminal";
			if (showToast) toast.error(message);
			return { success: false, message };
		}

		let message: string;
		if (result.isNewSession) {
			message = `Executando em ${project.name}`;
		} else if (result.isNewWindow) {
			message = `Executando: ${task.title}`;
		} else {
			message = `Executando em ${task.title}`;
		}

		if (showToast) toast.success(message);
		return { success: true, message, result };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Erro ao executar";
		if (showToast) toast.error(message);
		return { success: false, message };
	}
}

/**
 * Fecha o terminal inteiro de um projeto (todas as tabs).
 */
export async function closeProjectTerminal(
	projectId: string,
	options: OpenTerminalOptions = {},
): Promise<boolean> {
	const { showToast = true } = options;

	if (!isTauri()) {
		return false;
	}

	try {
		const success = await tauriCloseProjectSession(projectId);
		if (showToast) {
			if (success) {
				toast.success("Terminal do projeto encerrado");
			} else {
				toast.error("Falha ao encerrar terminal");
			}
		}
		return success;
	} catch {
		if (showToast) toast.error("Erro ao encerrar terminal");
		return false;
	}
}

/**
 * Fecha apenas a tab de uma tarefa específica.
 */
export async function closeTaskTerminal(
	projectId: string,
	task: TaskInfo,
	options: OpenTerminalOptions = {},
): Promise<boolean> {
	const { showToast = true } = options;

	if (!isTauri()) {
		return false;
	}

	try {
		const success = await tauriCloseTaskWindow(projectId, task.id, task.title);
		if (showToast) {
			if (success) {
				toast.success("Tab da tarefa encerrada");
			} else {
				toast.error("Falha ao encerrar tab");
			}
		}
		return success;
	} catch {
		if (showToast) toast.error("Erro ao encerrar tab");
		return false;
	}
}

// ============================================================================
// FUNÇÕES LEGADAS (para compatibilidade)
// ============================================================================

/** @deprecated Use openProjectTerminal ou executeInTerminal */
export function handleOpenTerminal(params: {
	projectId: string;
	projectName: string;
	mainRoute: string;
	taskId?: string;
	taskTitle?: string;
	model?: string;
	prompt?: string;
}): Promise<TerminalResult> {
	const project: ProjectInfo = {
		id: params.projectId,
		name: params.projectName,
		mainRoute: params.mainRoute,
	};

	if (params.prompt) {
		const task: TaskInfo = {
			id: params.taskId ?? `project_${params.projectId.slice(0, 8)}`,
			title: params.taskTitle ?? params.projectName,
		};
		return executeInTerminal(project, task, params.prompt, params.model);
	}

	if (params.taskId && params.taskTitle) {
		const task: TaskInfo = { id: params.taskId, title: params.taskTitle };
		return openTaskTerminal(project, task);
	}

	return openProjectTerminal(project);
}

/** @deprecated Use closeProjectTerminal */
export function handleCloseProjectTerminal(projectId: string): Promise<boolean> {
	return closeProjectTerminal(projectId);
}

/** @deprecated Use closeTaskTerminal */
export function handleCloseTaskWindow(
	projectId: string,
	taskId: string,
	taskTitle: string,
): Promise<boolean> {
	return closeTaskTerminal(projectId, { id: taskId, title: taskTitle });
}
