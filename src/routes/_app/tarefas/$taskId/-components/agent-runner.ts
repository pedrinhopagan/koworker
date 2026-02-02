import type { SkillId } from "./skill-registry";

export type RunSkillParams = {
	skillId: SkillId;
	prompt: string;
	agent: string;
	model: string;
	taskId: string;
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
	const { skillId, prompt, agent, model, taskId } = params;

	console.log("=".repeat(60));
	console.log("[Agent Runner] Executando skill:", skillId);
	console.log("[Agent Runner] Agent:", agent);
	console.log("[Agent Runner] Model:", model);
	console.log("[Agent Runner] Task ID:", taskId);
	console.log("[Agent Runner] Prompt:");
	console.log(prompt);
	console.log("=".repeat(60));

	await new Promise<void>((resolve) => {
		setTimeout(() => resolve(), 1500);
	});

	const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

	return {
		executionId,
		status: "success",
		message: `Skill "${skillId}" executada com sucesso via ${agent}`,
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
