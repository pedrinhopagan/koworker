import { describe, expect, it } from "bun:test";

import { shouldPreserveOrderedSubtasks } from "./task-subtasks";

const makeSubtask = (overrides: Record<string, unknown> = {}) => ({
	id: "sub-1",
	taskId: "task-1",
	title: "Subtask",
	description: "Detalhe",
	status: "pending",
	completedAt: null,
	createdAt: 1,
	updatedAt: 1,
	displayOrder: 0,
	...overrides,
});

describe("shouldPreserveOrderedSubtasks", () => {
	it("retorna false quando status muda com mesmos ids", () => {
		const previous = [makeSubtask({ id: "sub-1", status: "pending", updatedAt: 1 })] as any;
		const next = [makeSubtask({ id: "sub-1", status: "executed", updatedAt: 2 })] as any;

		expect(shouldPreserveOrderedSubtasks(previous, next)).toBe(false);
	});

	it("retorna true quando lista permanece igual", () => {
		const previous = [
			makeSubtask({ id: "sub-1" }),
			makeSubtask({ id: "sub-2", displayOrder: 1 }),
		] as any;
		const next = [
			makeSubtask({ id: "sub-1" }),
			makeSubtask({ id: "sub-2", displayOrder: 1 }),
		] as any;

		expect(shouldPreserveOrderedSubtasks(previous, next)).toBe(true);
	});
});
