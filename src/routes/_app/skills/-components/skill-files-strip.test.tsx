import "../../../../../tests/web/setup-dom";

import { afterEach, describe, expect, test } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	userEvent,
	waitFor,
} from "../../../../../tests/web/testing-library";
import { SkillFilesStrip } from "./skill-files-strip";

afterEach(cleanup);

const files = [
	{ path: "SKILL.md", size: 20, kind: "text" as const, hash: "one" },
	{ path: "assets/vazio.txt", size: 0, kind: "text" as const, hash: "two" },
	{ path: "assets/logo.png", size: 42, kind: "binary" as const, hash: "three" },
];

function renderStrip() {
	return render(
		<div data-theme-root>
			<SkillFilesStrip
				files={files}
				onCopyContent={() => {}}
				onCopyPath={() => {}}
				onOpenFolder={() => {}}
			/>
		</div>,
	);
}

function menuItems() {
	return [...document.querySelectorAll('[role="menuitem"]')].map((item) =>
		item.textContent?.trim(),
	);
}

describe.serial("SkillFilesStrip", () => {
	test("mostra seleção, hierarquia, vazio e binário", () => {
		renderStrip();
		const cards = document.querySelectorAll('[data-slot="skill-file-card"]');
		expect(cards).toHaveLength(3);
		const skillCard = cards[0];
		const binaryCard = cards[2];
		if (!(skillCard instanceof HTMLElement) || !(binaryCard instanceof HTMLElement)) {
			throw new Error("Cards esperados não encontrados");
		}
		expect(skillCard.dataset.selected).toBe("true");
		expect(cards[1]?.textContent).toContain("assets/vazio.txt");
		expect(cards[1]?.textContent).toContain("Vazio");
		expect(binaryCard.dataset.kind).toBe("binary");
		expect(cards[2]?.textContent).toContain("Binário");
	});

	test("contextmenu e botão touch expõem as mesmas ações e bloqueiam conteúdo binário", async () => {
		renderStrip();
		const binaryCard = document.querySelectorAll('[data-slot="skill-file-card"]')[2];
		if (!(binaryCard instanceof HTMLElement)) {
			throw new Error("Card binário não encontrado");
		}

		fireEvent.contextMenu(binaryCard);
		await waitFor(() =>
			expect(menuItems()).toEqual(["Copiar conteúdo", "Copiar caminho relativo", "Abrir na pasta"]),
		);
		expect(document.querySelector('[role="menuitem"][data-disabled]')).not.toBeNull();
		fireEvent.keyDown(document, { key: "Escape" });
		await waitFor(() => expect(menuItems()).toEqual([]));

		const actions = binaryCard.querySelector('button[aria-label="Ações de assets/logo.png"]');
		if (!(actions instanceof HTMLElement)) {
			throw new Error("Botão de ações não encontrado");
		}
		await userEvent.setup().click(actions);
		await waitFor(() =>
			expect(menuItems()).toEqual(["Copiar conteúdo", "Copiar caminho relativo", "Abrir na pasta"]),
		);
		expect(document.querySelector('[role="menuitem"][data-disabled]')).not.toBeNull();
	});
});
