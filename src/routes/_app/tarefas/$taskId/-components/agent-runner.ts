import {
	executeInTerminal,
	type ProjectInfo,
	type TaskInfo as TerminalTaskInfo,
} from "@/lib/terminal";

import type { SkillId } from "./skill-registry";

export type TaskWithProject = {
	id: string;
	title: string;
	projectId: string;
	project?: {
		id: string;
		name: string;
		mainRoute: string;
	} | null;
};

export type RunSkillParams = {
	skillId: SkillId;
	prompt: string;
	agent: string;
	model: string;
	taskId: string;
	task: TaskWithProject;
};

export type RunSkillResult = {
	executionId: string;
	status: "success" | "error";
	message?: string;
};

const STORAGE_KEYS = {
	AGENT: "kowork_selected_agent",
	MODEL: "kowork_selected_model",
} as const;

export function getStoredAgent(): string | null {
	if (typeof window === "undefined") return null;
	return localStorage.getItem(STORAGE_KEYS.AGENT);
}

export function setStoredAgent(agent: string): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEYS.AGENT, agent);
}

export function getStoredModel(): string | null {
	if (typeof window === "undefined") return null;
	return localStorage.getItem(STORAGE_KEYS.MODEL);
}

export function setStoredModel(model: string): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEYS.MODEL, model);
}

export async function runSkill(params: RunSkillParams): Promise<RunSkillResult> {
	const { prompt, model, task } = params;
	const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

	if (!task.project) {
		return {
			executionId,
			status: "error",
			message: "Projeto não encontrado para esta tarefa",
		};
	}

	const project: ProjectInfo = {
		id: task.project.id,
		name: task.project.name,
		mainRoute: task.project.mainRoute,
	};

	const terminalTask: TerminalTaskInfo = {
		id: task.id,
		title: task.title,
	};

	const result = await executeInTerminal(project, terminalTask, prompt, model);

	return {
		executionId,
		status: result.success ? "success" : "error",
		message: result.message,
	};
}

export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (error) {
		console.error("[Clipboard] Erro ao copiar:", error);

		try {
			const textArea = document.createElement("textarea");
			textArea.value = text;
			textArea.style.position = "fixed";
			textArea.style.left = "-999999px";
			textArea.style.top = "-999999px";
			document.body.append(textArea);
			textArea.focus();
			textArea.select();
			const success = document.execCommand("copy");
			textArea.remove();
			return success;
		} catch (fallbackError) {
			console.error("[Clipboard] Fallback também falhou:", fallbackError);
			return false;
		}
	}
}
