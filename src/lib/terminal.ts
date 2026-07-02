import { toast } from "sonner";

import { orpc, type RouterInputs, type RouterOutputs } from "@/client";

// O terminal agora é um serviço do backend (spawn via Bun.spawn na máquina local), então funciona
// igual no browser e no desktop — sem gate de Tauri. Cada função dispara a procedure e traduz o
// resultado num toast; a capacidade `canOpenTerminal` (há emulador configurado?) esconde a UI quando
// não há terminal.

export type ProjectInfo = {
	id: string;
	name: string;
	mainRoute: string;
};

export type TaskInfo = {
	id: string;
	title: string;
};

export type ProjectRef = {
	id: string;
	name: string;
};

type Route = {
	id: string;
	name: string;
	path: string;
	command?: string;
};

type OpenTerminalResult = RouterOutputs["terminal"]["openForTask"];

export type TerminalResult = {
	success: boolean;
	message: string;
	result?: OpenTerminalResult;
};

type OpenTerminalOptions = {
	showToast?: boolean;
};

async function openTask(
	input: RouterInputs["terminal"]["openForTask"],
	showToast: boolean,
	describe: (result: OpenTerminalResult) => string,
): Promise<TerminalResult> {
	try {
		const result = await orpc.terminal.openForTask.call(input);
		const message = describe(result);
		if (showToast) toast.success(message);
		return { success: true, message, result };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Erro ao abrir terminal";
		if (showToast) toast.error(message);
		return { success: false, message };
	}
}

async function openRoute(
	input: RouterInputs["terminal"]["openForRoute"],
	showToast: boolean,
	describe: (result: OpenTerminalResult) => string,
): Promise<TerminalResult> {
	try {
		const result = await orpc.terminal.openForRoute.call(input);
		const message = describe(result);
		if (showToast) toast.success(message);
		return { success: true, message, result };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Erro ao abrir terminal";
		if (showToast) toast.error(message);
		return { success: false, message };
	}
}

// Abre ou foca o terminal do projeto (sessão nova quando não existe, foco quando já existe).
export function openProjectTerminal(
	project: ProjectInfo,
	options: OpenTerminalOptions = {},
): Promise<TerminalResult> {
	return openTask(
		{
			projectId: project.id,
			projectName: project.name,
			mainRoute: project.mainRoute,
			taskId: `project_${project.id.slice(0, 8)}`,
			taskTitle: project.name,
		},
		options.showToast ?? true,
		(result) => (result.isNewSession ? `Terminal aberto para ${project.name}` : "Terminal focado"),
	);
}

// Executa um prompt/comando `claude` numa aba da tarefa (abrindo o terminal se preciso).
export function executeInTerminal(
	project: ProjectInfo,
	task: TaskInfo,
	prompt: string,
	options: OpenTerminalOptions & {
		agent?: string;
		model?: string;
		effort?: string;
		permissionMode?: string;
		forceNew?: boolean;
		background?: boolean;
	} = {},
): Promise<TerminalResult> {
	const { showToast = true, agent, model, effort, permissionMode, forceNew, background } = options;

	return openTask(
		{
			projectId: project.id,
			projectName: project.name,
			mainRoute: project.mainRoute,
			taskId: task.id,
			taskTitle: task.title,
			prompt,
			...(agent ? { agent } : {}),
			...(model ? { model } : {}),
			...(effort ? { effort } : {}),
			...(permissionMode ? { permissionMode } : {}),
			...(forceNew ? { forceNew } : {}),
			...(background ? { background } : {}),
		},
		showToast,
		(result) => {
			if (result.isNewSession) return `Executando em ${project.name}`;
			if (result.isNewWindow) return `Executando: ${task.title}`;
			return `Executando em ${task.title}`;
		},
	);
}

// Abre/foca uma aba nomeada pelo apelido de uma rota personalizada do projeto.
export function openProjectRoute(params: {
	projectId: string;
	projectName: string;
	route: Route;
	options?: OpenTerminalOptions;
}): Promise<TerminalResult> {
	const { projectId, projectName, route, options = {} } = params;

	return openRoute(
		{
			projectId,
			projectName,
			routeId: route.id,
			routeName: route.name,
			routePath: route.path,
			...(route.command ? { command: route.command } : {}),
		},
		options.showToast ?? true,
		(result) =>
			result.isNewWindow ? `Terminal aberto: ${route.name}` : `Focando em ${route.name}`,
	);
}

export function runTerminalInBackground(
	project: ProjectInfo,
	task: TaskInfo,
	options: OpenTerminalOptions = {},
): Promise<TerminalResult> {
	return openTask(
		{
			projectId: project.id,
			projectName: project.name,
			mainRoute: project.mainRoute,
			taskId: task.id,
			taskTitle: task.title,
			background: true,
		},
		options.showToast ?? true,
		() => `Executando em background: ${task.title}`,
	);
}

export function forceNewTerminalTab(
	project: ProjectInfo,
	task: TaskInfo,
	options: OpenTerminalOptions = {},
): Promise<TerminalResult> {
	return openTask(
		{
			projectId: project.id,
			projectName: project.name,
			mainRoute: project.mainRoute,
			taskId: task.id,
			taskTitle: task.title,
			forceNew: true,
		},
		options.showToast ?? true,
		() => `Nova tab aberta: ${task.title}`,
	);
}

export function runRouteInBackground(
	projectId: string,
	projectName: string,
	route: Route,
	options: OpenTerminalOptions = {},
): Promise<TerminalResult> {
	return openRoute(
		{
			projectId,
			projectName,
			routeId: route.id,
			routeName: route.name,
			routePath: route.path,
			...(route.command ? { command: route.command } : {}),
			background: true,
		},
		options.showToast ?? true,
		() => `Executando em background: ${route.name}`,
	);
}

export function forceNewRouteTab(
	projectId: string,
	projectName: string,
	route: Route,
	options: OpenTerminalOptions = {},
): Promise<TerminalResult> {
	return openRoute(
		{
			projectId,
			projectName,
			routeId: route.id,
			routeName: route.name,
			routePath: route.path,
			...(route.command ? { command: route.command } : {}),
			forceNew: true,
		},
		options.showToast ?? true,
		() => `Nova tab aberta: ${route.name}`,
	);
}

// Fecha o terminal inteiro do projeto (todas as abas).
export async function closeProjectTerminal(
	projectId: string,
	projectName: string,
	options: OpenTerminalOptions = {},
): Promise<boolean> {
	const { showToast = true } = options;

	try {
		await orpc.terminal.closeProjectSession.call({ projectId, projectName });
		if (showToast) toast.success("Terminal do projeto encerrado");
		return true;
	} catch {
		if (showToast) toast.error("Erro ao encerrar terminal");
		return false;
	}
}

// Fecha só as abas de invocação de agent/skill dos projetos escolhidos, preservando terminal, tarefas
// e rotas. Retorna quantas foram encerradas.
export async function closeInvocationTerminals(
	projects: ProjectRef[],
	options: OpenTerminalOptions = {},
): Promise<number> {
	const { showToast = true } = options;

	try {
		const { closed } = await orpc.terminal.closeInvocationSessions.call({ projects });
		if (showToast) {
			toast.success(
				closed > 0
					? `${closed} terminal(is) de invocação encerrado(s)`
					: "Nenhum terminal de invocação encerrado",
			);
		}
		return closed;
	} catch {
		if (showToast) toast.error("Erro ao encerrar terminais de invocação");
		return 0;
	}
}
