import { describe, expect, it } from "bun:test";

import { buildControlPanelClipboardText, shouldDisableControlPanelCopy } from "./control-panel";

describe("control-panel", () => {
	it("copia exatamente o texto digitado no painel", () => {
		const text = "Primeira linha\nSegunda linha\n\nChecklist final";

		expect(buildControlPanelClipboardText(text)).toBe(text);
	});

	it("desabilita a acao quando o painel estiver vazio", () => {
		expect(shouldDisableControlPanelCopy({ userInput: "", disabled: false })).toBe(true);
		expect(shouldDisableControlPanelCopy({ userInput: "   ", disabled: false })).toBe(true);
	});

	it("mantem a acao habilitada quando houver texto e o painel estiver ativo", () => {
		expect(shouldDisableControlPanelCopy({ userInput: "Copiar isso", disabled: false })).toBe(
			false,
		);
	});

	it("desabilita a acao quando o painel geral estiver bloqueado", () => {
		expect(shouldDisableControlPanelCopy({ userInput: "Copiar isso", disabled: true })).toBe(true);
	});
});
