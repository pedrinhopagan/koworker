import type { SubtaskFull, TaskFull } from "@/types/tasks";

import type { Skill } from "./skill-registry";

export type BuildPromptParams = {
	userInput: string;
	skill: Skill;
	task: NonNullable<TaskFull>;
	selectedSubtaskIds: string[];
	agent: string;
	model: string;
};

export type TaskPromptJson = {
	id: string;
	projectId: string;
	title: string;
	description: string | null;
	notes: string | null;
	aiMetadata: unknown;
	priorityId: string;
	categoryId: string;
	status: string;
	acceptanceCriteria: Array<{ id: string; text: string; done: boolean }>;
	subtasks: SubtaskFull[];
	category: { id: string; name: string; color: string } | null;
	priority: { id: string; name: string; color: string; level: number } | null;
	project: { id: string; name: string; color: string; mainRoute: string } | null;
	selectedSubtaskIds: string[];
	selectedSubtasks: SubtaskFull[];
	agent: string;
	model: string;
	timestamp: string;
	locale: string;
};

export function buildPrompt(params: BuildPromptParams): string {
	const { userInput, skill, task, selectedSubtaskIds, agent, model } = params;

	const selectedSubtasks = task.subtasks?.filter((s) => selectedSubtaskIds.includes(s.id)) ?? [];

	const taskJson: TaskPromptJson = {
		id: task.id,
		projectId: task.projectId,
		title: task.title,
		description: task.description ?? null,
		notes: task.notes ?? null,
		aiMetadata: task.aiMetadata,
		priorityId: task.priorityId,
		categoryId: task.categoryId,
		status: task.status,
		acceptanceCriteria: task.acceptanceCriteria,
		subtasks: task.subtasks ?? [],
		category: task.category,
		priority: task.priority,
		project: task.project,
		selectedSubtaskIds,
		selectedSubtasks,
		agent,
		model,
		timestamp: new Date().toISOString(),
		locale: "pt-BR",
	};

	const userInputSection = userInput.trim()
		? `${userInput.trim()}

A partir desse input do usuário, utilize a skill ${skill.label}`
		: `Utilize a skill ${skill.label}`;

	return `${userInputSection}

${skill.instructions}

Observação: no final existe um JSON com todos os dados relevantes da tarefa para você usar como fonte de verdade.

JSON:
${JSON.stringify(taskJson, null, 2)}`;
}

export function getCustomInstructions(skillId: string): string | null {
	if (typeof window === "undefined") return null;
	const key = `kowork_skill_instructions_${skillId}`;
	return localStorage.getItem(key);
}

export function setCustomInstructions(skillId: string, instructions: string): void {
	if (typeof window === "undefined") return;
	const key = `kowork_skill_instructions_${skillId}`;
	if (instructions.trim()) {
		localStorage.setItem(key, instructions);
	} else {
		localStorage.removeItem(key);
	}
}

export function buildPromptWithCustomInstructions(params: BuildPromptParams): string {
	const customInstructions = getCustomInstructions(params.skill.id);

	if (customInstructions) {
		return buildPrompt({
			...params,
			skill: {
				...params.skill,
				instructions: customInstructions,
			},
		});
	}

	return buildPrompt(params);
}
