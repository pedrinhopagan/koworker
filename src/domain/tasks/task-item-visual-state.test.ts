import { describe, expect, it } from "bun:test";
import {
	deriveTaskItemVisualState,
	getTaskItemStatusPresentation,
} from "@/domain/tasks/task-item-visual-state";

describe("task-item-visual-state", () => {
	it("usa fallback do chip quando faltam sinais", () => {
		const presentation = getTaskItemStatusPresentation({
			status: "pending",
			description: null,
			aiMetadata: null,
			subtasks: [],
			acceptanceCriteria: [],
			completedAt: null,
		});

		expect(presentation.isFallback).toBe(true);
		expect(presentation.state).toBe("idle");
		expect(presentation.label).toBe("Pendente");
	});

	it("prioriza trabalho em andamento como destaque maximo", () => {
		const presentation = getTaskItemStatusPresentation({
			status: "in_execution",
			subtasks: [],
			acceptanceCriteria: [],
			completedAt: null,
		});

		expect(presentation.state).toBe("in-execution");
		expect(presentation.indicator).toBe("spinner");
		expect(presentation.requiresAttention).toBe(true);
		expect(presentation.label).toBe("Em andamento");
	});

	it("usa criterios para diferenciar revisao e commit", () => {
		const readyToReview = deriveTaskItemVisualState({
			status: "pending",
			subtasks: [{ status: "executed" }, { status: "executed" }],
			acceptanceCriteria: [{ done: true }, { done: false }],
			completedAt: null,
		});

		const readyToCommit = deriveTaskItemVisualState({
			status: "pending",
			subtasks: [{ status: "executed" }, { status: "executed" }],
			acceptanceCriteria: [{ done: true }, { done: true }],
			completedAt: null,
		});

		expect(readyToReview).toBe("ready-to-review");
		expect(readyToCommit).toBe("ready-to-commit");
	});

	it("marca concluida quando completedAt existe", () => {
		const state = deriveTaskItemVisualState({
			status: "pending",
			subtasks: [{ status: "executed" }],
			acceptanceCriteria: [{ done: true }],
			completedAt: Date.now(),
		});

		expect(state).toBe("done");
	});

	it("retorna in-execution quando subtask esta em execucao", () => {
		const state = deriveTaskItemVisualState({
			status: "pending",
			subtasks: [{ status: "in_execution" }, { status: "pending" }],
			acceptanceCriteria: [],
			completedAt: null,
		});

		expect(state).toBe("in-execution");
	});

	it("retorna in-execution para subtasks parcialmente concluidas", () => {
		const state = deriveTaskItemVisualState({
			status: "pending",
			subtasks: [{ status: "executed" }, { status: "pending" }],
			acceptanceCriteria: [],
			completedAt: null,
		});

		expect(state).toBe("in-execution");
	});

	it("retorna ready-to-start quando tem subtasks mas nenhuma iniciada", () => {
		const state = deriveTaskItemVisualState({
			status: "pending",
			subtasks: [{ status: "pending" }, { status: "pending" }],
			acceptanceCriteria: [],
			completedAt: null,
		});

		expect(state).toBe("ready-to-start");
	});

	it("retorna started quando tem descricao mas sem subtasks", () => {
		const state = deriveTaskItemVisualState({
			status: "pending",
			description: "Uma descricao qualquer",
			subtasks: [],
			acceptanceCriteria: [],
			completedAt: null,
		});

		expect(state).toBe("started");
	});

	it("retorna started quando lastAction e structure", () => {
		const state = deriveTaskItemVisualState({
			status: "pending",
			aiMetadata: { lastCompletedAction: "structure" },
			subtasks: [],
			acceptanceCriteria: [],
			completedAt: null,
		});

		expect(state).toBe("started");
	});

	it("retorna done quando status e executed sem subtasks", () => {
		const state = deriveTaskItemVisualState({
			status: "executed",
			subtasks: [],
			acceptanceCriteria: [],
			completedAt: null,
		});

		expect(state).toBe("done");
	});

	it("normaliza status done de subtask para executed", () => {
		const state = deriveTaskItemVisualState({
			status: "pending",
			subtasks: [{ status: "done" }, { status: "pending" }],
			acceptanceCriteria: [],
			completedAt: null,
		});

		expect(state).toBe("in-execution");
	});
});
