import { describe, expect, it } from "bun:test";

import type { TaskFull } from "@/types/tasks";
import { type BuildPromptParams, buildCleanPrompt, buildPrompt } from "./build-prompt";

describe("buildPrompt", () => {
	it("organiza o prompt com instrucoes globais, usuario, skill obrigatoria e dados", () => {
		const task = {
			id: "task-1",
			projectId: "project-1",
			title: "Titulo",
			description: "Descricao",
			notes: null,
			aiMetadata: { source: "test" },
			priorityId: "priority-1",
			categoryId: "category-1",
			status: "pending",
			acceptanceCriteria: [{ id: "crit-1", text: "Criterio 1", done: false }],
			subtasks: [
				{
					id: "sub-1",
					title: "Subtask 1",
					description: "Detalhe",
					status: "pending",
					completedAt: null,
					createdAt: "2025-01-01T00:00:00.000Z",
					updatedAt: "2025-01-01T00:00:00.000Z",
				},
			],
			category: { id: "category-1", name: "feature", color: "#fff" },
			priority: { id: "priority-1", name: "Alta", color: "#000", level: 1 },
			project: { id: "project-1", name: "Projeto", color: "#111", mainRoute: "/" },
		} as unknown as NonNullable<TaskFull>;

		const prompt = buildPrompt({
			userInput: "Preciso deste ajuste",
			skill: {
				id: "koworker-structure",
				slug: "koworker-structure",
				label: "Estruturar",
				description: "Estrutura a tarefa",
				instructions: "NAO-DEVE-APARECER",
				icon: "ListChecks",
				color: "#fff",
				source: "builtin",
				requiresSubtaskSelection: false,
			},
			task,
			selectedSubtaskIds: ["sub-1"],
		} as unknown as BuildPromptParams);

		expect(prompt).toContain("## Instrucoes do Koworker");
		expect(prompt).toContain("## Prompt do Usuario");
		expect(prompt).toContain("Preciso deste ajuste");
		expect(prompt).toContain("## Skill Obrigatoria");
		expect(prompt).toContain('VOCE DEVE usar a skill "koworker-structure"');
		expect(prompt).toContain("NAO RACIONALIZE");
		expect(prompt).toContain("## Dados da Tarefa (Koworker)");
		expect(prompt).not.toContain("NAO-DEVE-APARECER");

		const sections = [
			"## Instrucoes do Koworker",
			"## Prompt do Usuario",
			"## Skill Obrigatoria",
			"## Dados da Tarefa (Koworker)",
		];

		const positions = sections.map((section) => prompt.indexOf(section));
		expect(positions.every((position) => position >= 0)).toBe(true);
		for (let index = 1; index < positions.length; index += 1) {
			expect(positions[index]).toBeGreaterThan(positions[index - 1]);
		}
	});
});

describe("buildCleanPrompt", () => {
	it("gera prompt enxuto com userInput e skill", () => {
		const prompt = buildCleanPrompt({
			userInput: "Faca isso rapidamente",
			skillSlug: "koworker-quickfix",
		});

		expect(prompt).toContain("Faca isso rapidamente");
		expect(prompt).toContain('Use a skill "koworker-quickfix"');
		expect(prompt).toContain("Nao mencione a tarefa");
	});

	it("gera prompt apenas com skill quando userInput vazio", () => {
		const prompt = buildCleanPrompt({
			userInput: "",
			skillSlug: "koworker-structure",
		});

		expect(prompt).toBe('Use a skill "koworker-structure". Nao mencione a tarefa.');
	});
});
