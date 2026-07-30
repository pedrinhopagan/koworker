import { afterEach, describe, expect, test } from "bun:test";
import { screen } from "@testing-library/react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

// Confirmação aberta a partir de um item de menu: menu e dialog coexistem por um instante, e o
// travamento da página aparece quando `@radix-ui/react-focus-scope` e
// `@radix-ui/react-dismissable-layer` são resolvidos em cópias diferentes — cada cópia tem a própria
// pilha de camadas, então nenhuma pausa a outra. Os `overrides` do package.json mantêm uma cópia só,
// e este teste é o que acusa a volta da duplicata.
function MenuConfirmHarness() {
	const [confirming, setConfirming] = useState(false);

	return (
		<div data-theme-root>
			<DropdownMenu>
				<DropdownMenuTrigger>ações</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem onSelect={() => setConfirming(true)}>Fechar workspace</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<ConfirmDialog
				open={confirming}
				onClose={() => setConfirming(false)}
				onConfirm={() => setConfirming(false)}
				title="Fechar kw_kowork?"
			/>
		</div>
	);
}

async function openConfirmFromMenu() {
	render(<MenuConfirmHarness />);
	fireEvent.pointerDown(screen.getByText("ações"), { button: 0, ctrlKey: false });
	fireEvent.click(await screen.findByText("Fechar workspace"));
	await screen.findByRole("alertdialog");
}

describe("ConfirmDialog aberto por menu", () => {
	test("devolve o ponteiro à página ao cancelar", async () => {
		await openConfirmFromMenu();

		fireEvent.click(screen.getByText("Cancelar"));
		await Bun.sleep(50);

		expect(document.body.style.pointerEvents).toBe("");
	});

	test("devolve o ponteiro à página ao confirmar", async () => {
		await openConfirmFromMenu();

		fireEvent.click(screen.getByText("Confirmar"));
		await Bun.sleep(50);

		expect(document.body.style.pointerEvents).toBe("");
	});
});
