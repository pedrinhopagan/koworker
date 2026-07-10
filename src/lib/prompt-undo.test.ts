import { expect, test } from "bun:test";

import { PromptUndoHistory, type PromptSnapshot } from "./prompt-undo";

function snap(text: string, caret = text.length): PromptSnapshot {
	return { text, caret, images: [] };
}

function typeChars(history: PromptUndoHistory, from: string, insertion: string) {
	let current = from;
	for (const char of insertion) {
		const next = current + char;
		history.record(snap(current), next);
		current = next;
	}
	return current;
}

function backspaceChars(history: PromptUndoHistory, from: string, count: number) {
	let current = from;
	for (let i = 0; i < count; i++) {
		const next = current.slice(0, -1);
		history.record(snap(current), next);
		current = next;
	}
	return current;
}

test("desfazer digitação remove só a última palavra inserida", () => {
	const history = new PromptUndoHistory();
	const current = typeChars(history, "", "ola mundo");

	expect(history.undo(snap(current))?.text).toBe("ola ");
	expect(history.undo(snap("ola "))?.text).toBe("");
	expect(history.undo(snap(""))).toBeNull();
});

test("desfazer apagamento restaura a palavra inteira de uma vez", () => {
	const history = new PromptUndoHistory();
	const current = backspaceChars(history, "ola mundo", "mundo".length);

	expect(current).toBe("ola ");
	expect(history.undo(snap(current))?.text).toBe("ola mundo");
});

test("apagar atravessando o espaço quebra em grupos por palavra", () => {
	const history = new PromptUndoHistory();
	const current = backspaceChars(history, "ola mundo", "ola mundo".length);

	expect(current).toBe("");
	expect(history.undo(snap(""))?.text).toBe("ola ");
	expect(history.undo(snap("ola "))?.text).toBe("ola mundo");
});

test("mudança em bloco é um grupo próprio", () => {
	const history = new PromptUndoHistory();
	history.record(snap("ola "), "ola /kw ");
	const current = typeChars(history, "ola /kw ", "x");

	expect(history.undo(snap(current))?.text).toBe("ola /kw ");
	expect(history.undo(snap("ola /kw "))?.text).toBe("ola ");
});

test("trocar entre inserir e apagar abre grupo novo", () => {
	const history = new PromptUndoHistory();
	let current = typeChars(history, "", "ab");
	current = backspaceChars(history, current, 1);
	current = typeChars(history, current, "c");

	expect(current).toBe("ac");
	expect(history.undo(snap(current))?.text).toBe("a");
	expect(history.undo(snap("a"))?.text).toBe("ab");
	expect(history.undo(snap("ab"))?.text).toBe("");
});

test("refazer devolve o estado desfeito e edição nova limpa o refazer", () => {
	const history = new PromptUndoHistory();
	const current = typeChars(history, "", "ola mundo");

	const undone = history.undo(snap(current));
	expect(undone?.text).toBe("ola ");
	expect(history.redo(snap("ola "))?.text).toBe("ola mundo");

	history.undo(snap(current));
	history.record(snap("ola "), "ola x");
	expect(history.redo(snap("ola x"))).toBeNull();
});

test("snapshot preserva caret e imagens", () => {
	const history = new PromptUndoHistory();
	const prev: PromptSnapshot = {
		text: "antes [Imagem 1]",
		caret: 5,
		images: [{ index: 1, projectId: "p", name: "a.png" }],
	};
	history.record(prev, "antes ");

	expect(history.undo(snap("antes "))).toEqual(prev);
});
