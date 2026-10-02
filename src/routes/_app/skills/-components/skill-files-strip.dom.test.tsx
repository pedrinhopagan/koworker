import { afterEach, describe, expect, test } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	userEvent,
	waitFor,
} from "../../../../../tests/web/testing-library";
import { type SkillFileItem, SkillFilesStrip } from "./skill-files-strip";

afterEach(cleanup);

const files = [
	{ path: "SKILL.md", size: 20, kind: "text" as const, hash: "one" },
	{ path: "assets/vazio.txt", size: 0, kind: "text" as const, hash: "two" },
	{ path: "assets/logo.png", size: 42, kind: "binary" as const, hash: "three" },
];

function renderStrip(options?: { activePath?: string; onOpen?: (file: SkillFileItem) => void }) {
	return render(
		<div data-theme-root>
			<SkillFilesStrip
				files={files}
				activePath={options?.activePath ?? "SKILL.md"}
				onOpen={options?.onOpen ?? (() => {})}
				onCopyContent={() => {}}
				onCopyPath={() => {}}
				onOpenFolder={() => {}}
			/>
		</div>,
	);
}

function cards() {
	return [...document.querySelectorAll('[data-slot="skill-file-card"]')] as HTMLElement[];
}

function menuItems() {
	return [...document.querySelectorAll('[role="menuitem"]')].map((item) =>
		item.textContent?.trim(),
	);
}

describe.serial("SkillFilesStrip", () => {
	test("agrupa por pasta e mostra seleção, vazio e binário", () => {
		renderStrip();
		const [skillCard, emptyCard, binaryCard] = cards();
		expect(cards()).toHaveLength(3);
		expect(skillCard?.dataset.selected).toBe("true");
		expect(binaryCard?.dataset.selected).toBe("false");
		// Nome sozinho no card, pasta uma vez só no cabeçalho do grupo.
		expect(emptyCard?.textContent).toContain("vazio.txt");
		expect(emptyCard?.textContent).not.toContain("assets/");
		expect(document.body.textContent).toContain("assets/");
		expect(emptyCard?.textContent).toContain("Vazio");
		expect(binaryCard?.dataset.kind).toBe("binary");
		expect(binaryCard?.textContent).toContain("Binário");
	});

	test("abre arquivo de texto no clique e mantém o binário inerte", async () => {
		const opened: string[] = [];
		renderStrip({ onOpen: (file) => opened.push(file.path) });
		const user = userEvent.setup();

		const [, emptyCard, binaryCard] = cards();
		const openButton = (card: HTMLElement | undefined) => {
			const found = card?.querySelector("button:not([aria-label])");
			if (!(found instanceof HTMLButtonElement)) {
				throw new Error("Botão de abrir não encontrado");
			}
			return found;
		};

		await user.click(openButton(emptyCard));
		expect(opened).toEqual(["assets/vazio.txt"]);

		expect(openButton(binaryCard).disabled).toBe(true);
		await user.click(openButton(binaryCard));
		expect(opened).toEqual(["assets/vazio.txt"]);
	});

	test("contextmenu e botão touch expõem as mesmas ações e bloqueiam conteúdo binário", async () => {
		renderStrip();
		const binaryCard = cards()[2];
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
