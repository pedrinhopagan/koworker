import { toast } from "sonner";

import {
	isTauri,
	type OpenTerminalResult,
	openTerminalForTask,
	closeProjectSession as tauriCloseProjectSession,
	closeTaskWindow as tauriCloseTaskWindow,
} from "./tauri";

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
	options: OpenTerminalOptions & { agent?: string; forceNew?: boolean } = {},
): Promise<TerminalResult> {
	const { showToast = true, agent, forceNew } = options;

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
			prompt,
			agent,
			forceNew,
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
 * Abre terminal para uma rota personalizada do projeto.
 * Cria/foca uma tab tmux nomeada pelo apelido da rota.
 */
export async function openProjectRoute(params: {
	projectId: string;
	projectName: string;
	route: {
		id: string;
		name: string;
		path: string;
		command?: string;
	};
	options?: OpenTerminalOptions;
}): Promise<TerminalResult> {
	const { projectId, projectName, route, options = {} } = params;
	const { showToast = true } = options;

	if (!isTauri()) {
		console.log("=".repeat(60));
		console.log(`[Terminal] Modo browser - Route: ${route.name} at ${route.path}`);
		if (route.command) console.log(`Command: ${route.command}`);
		console.log("=".repeat(60));

		const message = "Modo browser: rota logada no console";
		if (showToast) toast.info(message);
		return { success: true, message };
	}

	try {
		const { invoke } = await import("@tauri-apps/api/core");

		const result = await invoke<OpenTerminalResult>("open_terminal_for_route", {
			projectId,
			projectName,
			routeId: route.id,
			routeName: route.name,
			routePath: route.path,
			command: route.command,
		});

		if (!result) {
			const message = "Falha ao abrir terminal para rota";
			if (showToast) toast.error(message);
			return { success: false, message };
		}

		const message = result.isNewWindow
			? `Terminal aberto: ${route.name}`
			: `Focando em ${route.name}`;

		if (showToast) toast.success(message);
		return { success: true, message, result };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Erro ao abrir terminal";
		if (showToast) toast.error(message);
		return { success: false, message };
	}
}

export async function runTerminalInBackground(
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
			background: true,
		});

		if (!result) {
			const message = "Falha ao executar em background";
			if (showToast) toast.error(message);
			return { success: false, message };
		}

		const message = `Executando em background: ${task.title}`;
		if (showToast) toast.success(message);
		return { success: true, message, result };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Erro ao executar em background";
		if (showToast) toast.error(message);
		return { success: false, message };
	}
}

export async function forceNewTerminalTab(
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
			forceNew: true,
		});

		if (!result) {
			const message = "Falha ao abrir nova tab";
			if (showToast) toast.error(message);
			return { success: false, message };
		}

		const message = `Nova tab aberta: ${task.title}`;
		if (showToast) toast.success(message);
		return { success: true, message, result };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Erro ao abrir nova tab";
		if (showToast) toast.error(message);
		return { success: false, message };
	}
}

export async function runRouteInBackground(
	projectId: string,
	projectName: string,
	route: {
		id: string;
		name: string;
		path: string;
		command?: string;
	},
	options: OpenTerminalOptions = {},
): Promise<TerminalResult> {
	const { showToast = true } = options;

	if (!isTauri()) {
		const message = "Terminal disponível apenas no app desktop";
		if (showToast) toast.warning(message);
		return { success: false, message };
	}

	try {
		const { invoke } = await import("@tauri-apps/api/core");

		const result = await invoke<OpenTerminalResult>("open_terminal_for_route", {
			projectId,
			projectName,
			routeId: route.id,
			routeName: route.name,
			routePath: route.path,
			command: route.command,
			background: true,
		});

		if (!result) {
			const message = "Falha ao executar em background";
			if (showToast) toast.error(message);
			return { success: false, message };
		}

		const message = `Executando em background: ${route.name}`;
		if (showToast) toast.success(message);
		return { success: true, message, result };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Erro ao executar em background";
		if (showToast) toast.error(message);
		return { success: false, message };
	}
}

export async function forceNewRouteTab(
	projectId: string,
	projectName: string,
	route: {
		id: string;
		name: string;
		path: string;
		command?: string;
	},
	options: OpenTerminalOptions = {},
): Promise<TerminalResult> {
	const { showToast = true } = options;

	if (!isTauri()) {
		const message = "Terminal disponível apenas no app desktop";
		if (showToast) toast.warning(message);
		return { success: false, message };
	}

	try {
		const { invoke } = await import("@tauri-apps/api/core");

		const result = await invoke<OpenTerminalResult>("open_terminal_for_route", {
			projectId,
			projectName,
			routeId: route.id,
			routeName: route.name,
			routePath: route.path,
			command: route.command,
			forceNew: true,
		});

		if (!result) {
			const message = "Falha ao abrir nova tab";
			if (showToast) toast.error(message);
			return { success: false, message };
		}

		const message = `Nova tab aberta: ${route.name}`;
		if (showToast) toast.success(message);
		return { success: true, message, result };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Erro ao abrir nova tab";
		if (showToast) toast.error(message);
		return { success: false, message };
	}
}

/**
 * Fecha o terminal inteiro de um projeto (todas as tabs).
 */
export async function closeProjectTerminal(
	projectId: string,
	projectName: string,
	options: OpenTerminalOptions = {},
): Promise<boolean> {
	const { showToast = true } = options;

	if (!isTauri()) {
		return false;
	}

	try {
		const success = await tauriCloseProjectSession(projectId, projectName);
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
	projectName: string,
	task: TaskInfo,
	options: OpenTerminalOptions = {},
): Promise<boolean> {
	const { showToast = true } = options;

	if (!isTauri()) {
		return false;
	}

	try {
		const success = await tauriCloseTaskWindow(projectId, projectName, task.id, task.title);
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
