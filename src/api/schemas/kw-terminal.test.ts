import { expect, test } from "bun:test";

import { KwTerminalNavigateSchema } from "./kw-terminal";

test("aceita uma rota interna de tarefa", () => {
	const parsed = KwTerminalNavigateSchema.safeParse({
		route: "/tarefas/feature-1/task-1/plano.md",
	});

	expect(parsed.success).toBe(true);
});

test("recusa rota relativa", () => {
	expect(KwTerminalNavigateSchema.safeParse({ route: "tarefas/feature-1" }).success).toBe(false);
});

test("recusa rota com host, que sairia do app", () => {
	expect(KwTerminalNavigateSchema.safeParse({ route: "https://exemplo.com" }).success).toBe(false);
	expect(KwTerminalNavigateSchema.safeParse({ route: "//exemplo.com" }).success).toBe(false);
});

test("recusa rota com javascript:", () => {
	expect(KwTerminalNavigateSchema.safeParse({ route: "javascript:alert(1)" }).success).toBe(false);
});

test("recusa campos extras no corpo", () => {
	expect(KwTerminalNavigateSchema.safeParse({ route: "/tarefas", replace: true }).success).toBe(
		false,
	);
});
