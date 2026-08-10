import { toast } from "sonner";

import { orpc, type RouterInputs, type RouterOutputs } from "@/client";
import type { InvokeCli } from "@/constants/invoke";
import { errorMessage } from "@/lib/orpc-errors";

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

type RouteRef = {
	id: string;
	name: string;
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

// Traz pra frente a sessão do CLI ativo que já está rodando no kw-terminal. Sem agent daquele CLI o
// backend abre uma no projeto em foco; sem projeto em foco responde com o motivo e viramos toast.
export async function focusCliAgent(params: {
	cli: InvokeCli;
	projectId?: string;
}): Promise<boolean> {
	try {
		const { agent, cwd, opened } = await orpc.terminal.focusAgent.call({
			cli: params.cli,
			...(params.projectId ? { projectId: params.projectId } : {}),
		});
		const where = cwd.split("/").at(-1) || cwd;
		toast.success(
			opened ? `Sessão ${agent} aberta em ${where}` : `Foco na sessão ${agent} em ${where}`,
		);
		return true;
	} catch (error) {
		toast.error(errorMessage(error, "Erro ao focar o agent no kw-terminal"));
		return false;
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
	options: OpenTerminalOptions &
		Pick<
			RouterInputs["terminal"]["openForTask"],
			"cli" | "agent" | "model" | "effort" | "permissionMode" | "forceNew" | "background"
		> = {},
): Promise<TerminalResult> {
	const {
		showToast = true,
		cli,
		agent,
		model,
		effort,
		permissionMode,
		forceNew,
		background,
	} = options;

	return openTask(
		{
			projectId: project.id,
			taskId: task.id,
			taskTitle: task.title,
			prompt,
			...(cli ? { cli } : {}),
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
	route: RouteRef;
	options?: OpenTerminalOptions;
}): Promise<TerminalResult> {
	const { projectId, route, options = {} } = params;

	return openRoute(
		{
			projectId,
			routeId: route.id,
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
	route: RouteRef,
	options: OpenTerminalOptions = {},
): Promise<TerminalResult> {
	return openRoute(
		{
			projectId,
			routeId: route.id,
			background: true,
		},
		options.showToast ?? true,
		() => `Executando em background: ${route.name}`,
	);
}

export function forceNewRouteTab(
	projectId: string,
	route: RouteRef,
	options: OpenTerminalOptions = {},
): Promise<TerminalResult> {
	return openRoute(
		{
			projectId,
			routeId: route.id,
			forceNew: true,
		},
		options.showToast ?? true,
		() => `Nova tab aberta: ${route.name}`,
	);
}

// Fecha o terminal inteiro do projeto (todas as abas).
export async function closeProjectTerminal(
	projectId: string,
	options: OpenTerminalOptions = {},
): Promise<boolean> {
	const { showToast = true } = options;

	try {
		await orpc.terminal.closeProjectSession.call({ projectId });
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

// Atalho de um clique: fecha as abas de invocação de todos os projetos e mata os Chromes/daemons
// órfãos do agent-browser que sobraram no host. Retorna quantas abas foram encerradas.
export async function sweepAllActiveTerminals(options: OpenTerminalOptions = {}): Promise<number> {
	const { showToast = true } = options;

	try {
		const { closed } = await orpc.terminal.sweepAllActive.call();
		if (showToast) {
			toast.success(
				closed > 0
					? `${closed} terminal(is) encerrado(s) e processos órfãos limpos`
					: "Processos órfãos limpos",
			);
		}
		return closed;
	} catch {
		if (showToast) toast.error("Erro ao limpar tudo ativo");
		return 0;
	}
}
