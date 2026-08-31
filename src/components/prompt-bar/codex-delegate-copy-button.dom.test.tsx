import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	userEvent,
	waitFor,
} from "../../../tests/web/testing-library";

import { CODEX_DELEGATE_DEFAULTS } from "@/constants/invoke";
import { usePromptBarStore } from "@/stores/prompt-bar";
import { CodexDelegateCopyButton } from "./codex-delegate-copy-button";

afterEach(cleanup);
beforeEach(() => {
	localStorage.clear();
	usePromptBarStore.setState({ codexDelegateModel: CODEX_DELEGATE_DEFAULTS.model });
});

function renderButton(onCopy = mock(() => {})) {
	return {
		onCopy,
		...render(
			<div data-theme-root>
				<CodexDelegateCopyButton onCopy={onCopy} />
			</div>,
		),
	};
}

describe.serial("CodexDelegateCopyButton", () => {
	test("começa em Sol medium e permite trocar o modelo pelo botão direito", async () => {
		const first = renderButton();
		const button = first.getByRole("button", { name: /copiar com codex.*gpt-5\.6 sol.*médio/i });

		fireEvent.contextMenu(button);
		const terra = await first.findByRole("menuitemradio", { name: /gpt-5\.6 terra/i });
		await userEvent.setup().click(terra);
		await userEvent.setup().click(button);

		expect(first.onCopy).toHaveBeenLastCalledWith("gpt-5.6-terra");

		await cleanup();
		const remounted = renderButton();
		const terraButton = remounted.getByRole("button", {
			name: /copiar com codex.*gpt-5\.6 terra.*médio/i,
		});
		await userEvent.setup().click(terraButton);
		expect(remounted.onCopy).toHaveBeenLastCalledWith("gpt-5.6-terra");

		window.dispatchEvent(new Event("pagehide"));
		expect(localStorage.getItem("kowork-prompt-bar")).not.toContain("codexDelegateModel");

		act(() => usePromptBarStore.setState({ codexDelegateModel: CODEX_DELEGATE_DEFAULTS.model }));
		const defaultButton = remounted.getByRole("button", {
			name: /copiar com codex.*gpt-5\.6 sol.*médio/i,
		});
		await userEvent.setup().click(defaultButton);
		expect(remounted.onCopy).toHaveBeenLastCalledWith("gpt-5.6-sol");
	});

	test("identifica o menu de contexto como seletor temporário de modelo", async () => {
		const view = renderButton();
		fireEvent.contextMenu(view.getByRole("button"));

		await waitFor(() => {
			expect(view.getByText("Modelo do Codex")).toBeTruthy();
			expect(view.getByText("Volta para Sol ao reiniciar o app")).toBeTruthy();
		});
	});
});
