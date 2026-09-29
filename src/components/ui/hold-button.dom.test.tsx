import { afterEach, describe, expect, mock, test } from "bun:test";
import { screen } from "@testing-library/react";

import { HOLD_BUTTON_MS, HoldButton } from "@/components/ui/hold-button";
import { cleanup, fireEvent, render } from "../../../tests/web/testing-library";

afterEach(cleanup);

function renderButton(disabled = false) {
	const onConfirm = mock(() => {});
	render(<HoldButton onConfirm={onConfirm} title="Excluir tarefa" disabled={disabled} />);
	return { onConfirm, button: screen.getByRole("button", { name: "Excluir tarefa" }) };
}

describe("HoldButton", () => {
	test("confirma depois de segurar o tempo inteiro", async () => {
		const { onConfirm, button } = renderButton();

		fireEvent.pointerDown(button, { button: 0 });
		await Bun.sleep(HOLD_BUTTON_MS + 50);

		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	test("soltar antes do fim cancela", async () => {
		const { onConfirm, button } = renderButton();

		fireEvent.pointerDown(button, { button: 0 });
		await Bun.sleep(HOLD_BUTTON_MS / 2);
		fireEvent.pointerUp(button);
		await Bun.sleep(HOLD_BUTTON_MS);

		expect(onConfirm).not.toHaveBeenCalled();
	});

	test("clique simples não confirma", async () => {
		const { onConfirm, button } = renderButton();

		fireEvent.click(button);
		await Bun.sleep(HOLD_BUTTON_MS + 50);

		expect(onConfirm).not.toHaveBeenCalled();
	});

	test("Espaço segurado confirma e soltar a tecla antes cancela", async () => {
		const { onConfirm, button } = renderButton();

		fireEvent.keyDown(button, { key: " " });
		await Bun.sleep(HOLD_BUTTON_MS / 2);
		fireEvent.keyUp(button, { key: " " });
		await Bun.sleep(HOLD_BUTTON_MS);
		expect(onConfirm).not.toHaveBeenCalled();

		fireEvent.keyDown(button, { key: "Enter" });
		fireEvent.keyDown(button, { key: "Enter", repeat: true });
		await Bun.sleep(HOLD_BUTTON_MS + 50);
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	test("desabilitado não confirma", async () => {
		const { onConfirm, button } = renderButton(true);

		fireEvent.pointerDown(button, { button: 0 });
		await Bun.sleep(HOLD_BUTTON_MS + 50);

		expect(onConfirm).not.toHaveBeenCalled();
	});
});
