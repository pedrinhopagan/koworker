import { expect, test } from "bun:test";

import { translatePaneInput } from "./pane-input";

const ESC = "";
const DEL = "";

test("texto puro vira uma digitação só", () => {
	expect(translatePaneInput("ola mundo")).toEqual([{ text: "ola mundo" }]);
});

test("backspace vira tecla nomeada e mantém a ordem do que foi digitado", () => {
	expect(translatePaneInput(`abc${DEL}${DEL}d`)).toEqual([
		{ text: "abc" },
		{ keys: ["backspace", "backspace"] },
		{ text: "d" },
	]);
});

test("enter, tab e ctrl+c saem do fluxo cru", () => {
	expect(translatePaneInput("\r")).toEqual([{ keys: ["enter"] }]);
	expect(translatePaneInput("\t")).toEqual([{ keys: ["tab"] }]);
	expect(translatePaneInput("")).toEqual([{ keys: ["ctrl+c"] }]);
	expect(translatePaneInput("")).toEqual([{ keys: ["ctrl+u"] }]);
});

test("setas, shift+tab e alt+tecla", () => {
	expect(translatePaneInput(`${ESC}[A${ESC}[D`)).toEqual([{ keys: ["up", "left"] }]);
	expect(translatePaneInput(`${ESC}OB`)).toEqual([{ keys: ["down"] }]);
	expect(translatePaneInput(`${ESC}[Z`)).toEqual([{ keys: ["shift+tab"] }]);
	expect(translatePaneInput(`${ESC}b`)).toEqual([{ keys: ["alt+b"] }]);
});

test("esc sozinho é esc; sequência que o daemon não conhece é descartada sem virar lixo no input", () => {
	expect(translatePaneInput(ESC)).toEqual([{ keys: ["esc"] }]);
	expect(translatePaneInput(`x${ESC}[3~y`)).toEqual([{ text: "xy" }]);
});

test("rajada de digitação com correção no meio", () => {
	expect(translatePaneInput(`kow${DEL}rker${ESC}[D\r`)).toEqual([
		{ text: "kow" },
		{ keys: ["backspace"] },
		{ text: "rker" },
		{ keys: ["left", "enter"] },
	]);
});
