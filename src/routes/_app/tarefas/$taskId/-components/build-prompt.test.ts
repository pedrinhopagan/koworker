import { describe, expect, it } from "bun:test";

import type { TaskFull } from "@/types/tasks";
import { type BuildPromptParams, buildCleanPrompt, buildPrompt } from "./build-prompt";

const makeTask = (overrides: Partial<NonNullable<TaskFull>> = {}) =>
	({
		id: "task-1",
		projectId: "project-1",
		title: "Titulo",
		description: "Descricao da tarefa",
		notes: null,
		aiMetadata: { lastCompletedAction: "structure" },
		priorityId: "priority-1",
		categoryId: "category-1",
		status: "pending",
		acceptanceCriteria: [
			{ id: "crit-1", text: "Criterio 1", done: false },
			{ id: "crit-2", text: "Criterio 2", done: true },
		],
		subtasks: [
			{
				id: "sub-1",
				title: "Subtask 1",
				description: "Detalhe da subtask 1",
				status: "pending",
				completedAt: null,
				createdAt: "2025-01-01T00:00:00.000Z",
				updatedAt: "2025-01-01T00:00:00.000Z",
			},
			{
				id: "sub-2",
				title: "Subtask 2",
				description: "Detalhe da subtask 2",
				status: "executed",
				completedAt: null,
				createdAt: "2025-01-01T00:00:00.000Z",
				updatedAt: "2025-01-01T00:00:00.000Z",
			},
		],
		category: { id: "category-1", name: "feature", color: "#fff" },
		priority: { id: "priority-1", name: "Alta", color: "#000", level: 1 },
		project: { id: "project-1", name: "Projeto", color: "#111", mainRoute: "/home/user/projeto" },
		...overrides,
	}) as unknown as NonNullable<TaskFull>;

const makeSkill = (slug = "koworker-structure") =>
	({
		id: slug,
		slug,
		label: "Estruturar",
		description: "Estrutura a tarefa",
		instructions: "NAO-DEVE-APARECER",
		icon: "ListChecks",
		color: "#fff",
		source: "builtin",
		requiresSubtaskSelection: false,
	}) as unknown as BuildPromptParams["skill"];

describe("buildPrompt", () => {
	it("gera markdown legivel com secoes na ordem correta", () => {
		const prompt = buildPrompt({
			userInput: "Preciso deste ajuste",
			skill: makeSkill(),
			task: makeTask(),
			selectedSubtaskIds: [],
		});

		expect(prompt).toContain("## Prompt do Usuario (Prioridade Alta)");
		expect(prompt).toContain("Preciso deste ajuste");
		expect(prompt).toContain("## Skill Obrigatoria");
		expect(prompt).toContain("## Dados da Tarefa (Koworker)");
		expect(prompt).not.toContain("NAO-DEVE-APARECER");

		const sections = [
			"## Prompt do Usuario (Prioridade Alta)",
			"## Skill Obrigatoria",
			"## Dados da Tarefa (Koworker)",
		];
		const positions = sections.map((s) => prompt.indexOf(s));
		expect(positions.every((p) => p >= 0)).toBe(true);
		for (let i = 1; i < positions.length; i++) {
			expect(positions[i]).toBeGreaterThan(positions[i - 1]);
		}
	});

	it("mostra dados da tarefa em markdown, nao JSON bruto", () => {
		const prompt = buildPrompt({
			userInput: "",
			skill: makeSkill(),
			task: makeTask(),
			selectedSubtaskIds: [],
		});

		expect(prompt).toContain("**Titulo:** Titulo");
		expect(prompt).toContain("**Status:** pendente");
		expect(prompt).toContain("**Projeto:** Projeto");
		expect(prompt).toContain("**Categoria:** feature");
		expect(prompt).toContain("**Prioridade:** Alta");
		expect(prompt).toContain("### Descricao");
		expect(prompt).toContain("Descricao da tarefa");
		expect(prompt).toContain("### Criterios de Aceite");
		expect(prompt).toContain("[x] `crit-2`");
		expect(prompt).toContain("[ ] `crit-1`");
		expect(prompt).not.toContain('"projectId"');
		expect(prompt).not.toContain('"categoryId"');
		expect(prompt).not.toContain('"priorityId"');
	});

	it("sem selecao, mostra todas as subtasks com descricao", () => {
		const prompt = buildPrompt({
			userInput: "",
			skill: makeSkill(),
			task: makeTask(),
			selectedSubtaskIds: [],
		});

		expect(prompt).toContain("#### Subtask 1");
		expect(prompt).toContain("Detalhe da subtask 1");
		expect(prompt).toContain("#### Subtask 2");
		expect(prompt).toContain("Detalhe da subtask 2");
		expect(prompt).not.toContain("Selecionadas para execucao");
		expect(prompt).not.toContain("Demais subtasks");
	});

	it("com selecao, destaca selecionadas e mostra demais so como contexto", () => {
		const prompt = buildPrompt({
			userInput: "",
			skill: makeSkill("koworker-execute-subtask"),
			task: makeTask(),
			selectedSubtaskIds: ["sub-1"],
		});

		expect(prompt).toContain("**Selecionadas para execucao (1):**");
		expect(prompt).toContain("#### ▶ Subtask 1");
		expect(prompt).toContain("Detalhe da subtask 1");

		expect(prompt).toContain("**Demais subtasks (apenas contexto):**");
		expect(prompt).toContain("- Subtask 2 — executada");
		expect(prompt).not.toContain("Detalhe da subtask 2");
	});

	it("mantem destaque do prompt do usuario mesmo sem texto", () => {
		const prompt = buildPrompt({
			userInput: "   ",
			skill: makeSkill(),
			task: makeTask({ subtasks: [] }),
			selectedSubtaskIds: [],
		});

		expect(prompt).toContain("## Prompt do Usuario (Prioridade Alta)");
		expect(prompt).toContain("Nenhuma instrucao adicional enviada pelo usuario.");
	});

	it("mostra metadados quando existem", () => {
		const prompt = buildPrompt({
			userInput: "",
			skill: makeSkill(),
			task: makeTask({ aiMetadata: { lastCompletedAction: "structure" } }),
			selectedSubtaskIds: [],
		});

		expect(prompt).toContain("### Metadados");
		expect(prompt).toContain("lastCompletedAction");
	});

	it("nao mostra metadados quando vazio", () => {
		const prompt = buildPrompt({
			userInput: "",
			skill: makeSkill(),
			task: makeTask({ aiMetadata: {} as never }),
			selectedSubtaskIds: [],
		});

		expect(prompt).not.toContain("### Metadados");
	});

	it("mostra indicador de tarefa pai selecionada", () => {
		const prompt = buildPrompt({
			userInput: "",
			skill: makeSkill(),
			task: makeTask(),
			selectedSubtaskIds: [],
			selectedParentTask: true,
		});

		expect(prompt).toContain("Tarefa pai selecionada para acao direta");
	});

	it("mostra notas da IA quando existem", () => {
		const prompt = buildPrompt({
			userInput: "",
			skill: makeSkill(),
			task: makeTask({ notes: "Notas importantes da revisao" }),
			selectedSubtaskIds: [],
		});

		expect(prompt).toContain("### Notas da IA");
		expect(prompt).toContain("Notas importantes da revisao");
	});
});

describe("buildCleanPrompt", () => {
	it("gera prompt enxuto com userInput e skill", () => {
		const prompt = buildCleanPrompt({
			userInput: "Faca isso rapidamente",
			skillSlug: "koworker-execute-all",
		});

		expect(prompt).toContain("Faca isso rapidamente");
		expect(prompt).toContain('Use a skill "koworker-execute-all"');
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
