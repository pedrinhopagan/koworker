import "../../../../../tests/web/setup-dom";

import { afterEach, describe, expect, test } from "bun:test";
import { get, query, slot } from "../../../../../tests/web/dom";
import { cleanup, render, userEvent, waitFor } from "../../../../../tests/web/testing-library";
import { SkillDocumentFrontmatter } from "./skill-document-frontmatter";

afterEach(cleanup);

function renderFrontmatter(
	metadata: Record<string, unknown>,
	onMetadataChange = (_next: Record<string, unknown>) => {},
	onSlugCommit = (_slug: string) => Promise.resolve(),
) {
	return render(
		<div data-theme-root data-component="test-theme">
			<SkillDocumentFrontmatter
				slug="real-name"
				description="Descrição"
				metadata={metadata}
				status="saved"
				renaming={false}
				onSlugCommit={onSlugCommit}
				onDescriptionChange={() => {}}
				onDescriptionCommit={() => {}}
				onMetadataChange={onMetadataChange}
			/>
		</div>,
	);
}

describe.serial("SkillDocumentFrontmatter", () => {
	test("inicia recolhido e mantém título e descrição visíveis", () => {
		renderFrontmatter({ model: "smartest" });
		const frontmatter = get("skill-document-frontmatter");

		expect(slot(frontmatter, "frontmatter-toggle").getAttribute("aria-expanded")).toBe("false");
		expect(slot(frontmatter, "slug-input")).toBeInstanceOf(HTMLInputElement);
		expect(slot(frontmatter, "description-input")).toBeInstanceOf(HTMLTextAreaElement);
		expect(query("skill-metadata-field", { key: "model" })).toBeNull();
	});

	test("confirma um novo slug válido ao sair do título", async () => {
		const slugs: string[] = [];
		renderFrontmatter({}, undefined, (slug) => {
			slugs.push(slug);
			return Promise.resolve();
		});
		const input = slot(get("skill-document-frontmatter"), "slug-input");
		const user = userEvent.setup();

		await user.clear(input);
		await user.type(input, "new-skill{Enter}");
		await waitFor(() => expect(slugs).toEqual(["new-skill"]));
	});

	test("Escape restaura o slug sem vazar para o atalho da página", async () => {
		let escaped = false;
		const slugs: string[] = [];
		const listener = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				escaped = true;
			}
		};
		document.addEventListener("keydown", listener);
		renderFrontmatter({}, undefined, (slug) => {
			slugs.push(slug);
			return Promise.resolve();
		});
		const input = slot(get("skill-document-frontmatter"), "slug-input") as HTMLInputElement;
		const user = userEvent.setup();

		await user.clear(input);
		await user.type(input, "temporary{Escape}");
		expect(input.value).toBe("real-name");
		expect(escaped).toBe(false);
		expect(slugs).toEqual([]);
		document.removeEventListener("keydown", listener);
	});

	test("oculta campos descartados sem removê-los do metadata", async () => {
		const changes: Record<string, unknown>[] = [];
		renderFrontmatter(
			{
				title: "Título antigo",
				icon: "Sparkles",
				color: "#fff",
				"allowed-tools": ["Read"],
				license: "MIT",
			},
			(next) => changes.push(next),
		);
		await userEvent.setup().click(slot(get("skill-document-frontmatter"), "frontmatter-toggle"));

		expect(query("skill-metadata-field", { key: "title" })).toBeNull();
		expect(query("skill-metadata-field", { key: "icon" })).toBeNull();
		expect(query("skill-metadata-field", { key: "color" })).toBeNull();
		expect(query("skill-metadata-field", { key: "allowed-tools" })).toBeNull();
		expect(query("skill-metadata-field", { key: "license" })).toBeNull();

		await userEvent
			.setup()
			.click(slot(get("skill-metadata-field", { key: "user-invocable" }), "boolean-row"));
		expect(changes.at(-1)?.title).toBe("Título antigo");
		expect(changes.at(-1)?.icon).toBe("Sparkles");
		expect(changes.at(-1)?.color).toBe("#fff");
		expect(changes.at(-1)?.["allowed-tools"]).toEqual(["Read"]);
		expect(changes.at(-1)?.license).toBe("MIT");
	});

	test("Herdado remove model do frontmatter", async () => {
		const changes: Record<string, unknown>[] = [];
		renderFrontmatter({ model: "smartest", effort: "high" }, (next) => changes.push(next));
		const user = userEvent.setup();
		await user.click(slot(get("skill-document-frontmatter"), "frontmatter-toggle"));
		const field = get("skill-metadata-field", { key: "model" });

		await user.click(slot(field, "custom-select-trigger"));
		await user.click(get("custom-select-item", { value: "__inherit__" }));
		expect(changes.at(-1)).toEqual({ effort: "high" });
	});

	test("clique direto no switch alterna uma única vez", async () => {
		const changes: Record<string, unknown>[] = [];
		renderFrontmatter({ "disable-model-invocation": false }, (next) => changes.push(next));

		const user = userEvent.setup();
		await user.click(slot(get("skill-document-frontmatter"), "frontmatter-toggle"));
		await user.click(
			slot(get("skill-metadata-field", { key: "disable-model-invocation" }), "switch"),
		);
		expect(changes).toHaveLength(1);
		expect(changes[0]?.["disable-model-invocation"]).toBe(true);
	});

	test("linha booleana funciona por teclado e preserva estado explícito", async () => {
		const changes: Record<string, unknown>[] = [];
		renderFrontmatter({}, (next) => changes.push(next));
		const user = userEvent.setup();
		await user.click(slot(get("skill-document-frontmatter"), "frontmatter-toggle"));
		const row = slot(get("skill-metadata-field", { key: "user-invocable" }), "boolean-row");

		row.focus();
		await user.keyboard("{Enter}");
		expect(changes).toHaveLength(1);
		expect(changes[0]?.["user-invocable"]).toBe(false);
	});

	test("YAML inválido mantém o draft e não dispara commit", async () => {
		const changes: Record<string, unknown>[] = [];
		renderFrontmatter({ custom: ["um", "dois"] }, (next) => changes.push(next));
		const user = userEvent.setup();
		await user.click(slot(get("skill-document-frontmatter"), "frontmatter-toggle"));
		const field = get("skill-metadata-field", { key: "custom" });
		const textarea = slot(field, "raw-input");

		await user.clear(textarea);
		await user.type(textarea, "chave: *missing");
		await user.tab();
		expect(changes).toHaveLength(0);
		expect((textarea as HTMLTextAreaElement).value).toBe("chave: *missing");
		await waitFor(() => expect(slot(field, "metadata-error")).toBeInstanceOf(HTMLElement));
	});

	test("tipo conhecido incompatível usa editor raw sem coerção", async () => {
		renderFrontmatter({ "disable-model-invocation": "false", model: ["opus"] });
		await userEvent.setup().click(slot(get("skill-document-frontmatter"), "frontmatter-toggle"));

		expect(get("skill-metadata-field", { key: "model" }).dataset.type).toBe("raw");
		expect(
			slot(get("skill-metadata-field", { key: "disable-model-invocation" }), "raw-input"),
		).toBeInstanceOf(HTMLTextAreaElement);
		expect(slot(get("skill-document-frontmatter"), "save-status").dataset.state).toBe("saved");
	});
});
