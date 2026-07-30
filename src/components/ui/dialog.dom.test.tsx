import { afterEach, describe, expect, test } from "bun:test";
import { screen } from "@testing-library/react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { cleanup, fireEvent, render } from "../../../tests/web/testing-library";

afterEach(cleanup);

function DialogHarness() {
	const [open, setOpen] = useState(true);

	return (
		<div data-theme-root>
			<Dialog
				open={open}
				onClose={() => setOpen(false)}
				title="Escolher projeto"
				description="Busque pelo nome"
			>
				<input aria-label="busca" autoFocus />
			</Dialog>
		</div>
	);
}

describe("Dialog", () => {
	test("expõe título e descrição acessíveis", async () => {
		render(<DialogHarness />);

		const dialog = await screen.findByRole("dialog");

		expect(dialog.getAttribute("aria-labelledby")).toBe(screen.getByText("Escolher projeto").id);
		expect(dialog.getAttribute("aria-describedby")).toBe(screen.getByText("Busque pelo nome").id);
	});

	test("move o foco pro conteúdo, não pro botão de fechar", async () => {
		render(<DialogHarness />);
		await screen.findByRole("dialog");

		expect(document.activeElement).toBe(screen.getByLabelText("busca"));
	});

	test("fecha no Esc", async () => {
		render(<DialogHarness />);
		const dialog = await screen.findByRole("dialog");

		fireEvent.keyDown(dialog, { key: "Escape" });

		expect(screen.queryByRole("dialog")).toBeNull();
	});
});

describe("ConfirmDialog", () => {
	test("usa role alertdialog", async () => {
		render(
			<div data-theme-root>
				<ConfirmDialog open onClose={() => {}} onConfirm={() => {}} title="Deletar nota" />
			</div>,
		);

		expect(await screen.findByRole("alertdialog")).toBeTruthy();
	});
});
