import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { screen } from "@testing-library/react";

import { useState } from "react";

import type { ModelCatalog } from "@/api/schemas/agent-radar";
import type { ModelTarget } from "@/lib/model-target";
import { get, query, slot } from "../../../tests/web/dom";
import { cleanup, render, userEvent } from "../../../tests/web/testing-library";
import { ModelPicker } from "./model-picker";

afterEach(() => cleanup());

const CATALOG: ModelCatalog = {
	claude: [
		{
			id: "fable",
			label: "Fable 5.1",
			hint: "Mais capaz",
			efforts: ["low", "high"],
			defaultEffort: null,
		},
		{
			id: "opus",
			label: "Opus 5",
			hint: "Dia a dia",
			efforts: ["low", "high"],
			defaultEffort: null,
		},
	],
	codex: [
		{
			id: "gpt-6-astra",
			label: "GPT 6 Astra",
			hint: "Mais capaz",
			efforts: ["medium", "high", "ultra"],
			defaultEffort: "medium",
		},
	],
};

const SESSION = { cli: "claude" as const, model: "fable", effort: "high" };

function renderPicker(value: ModelTarget, onChange: (target: ModelTarget) => void) {
	return render(
		<div data-theme-root>
			<ModelPicker catalog={CATALOG} session={SESSION} value={value} onChange={onChange} />
		</div>,
	);
}

describe("ModelPicker", () => {
	test("mostra o modelo e o esforço da sessão sem marcar pendência", () => {
		renderPicker(SESSION, () => {});

		const trigger = get("model-picker");
		expect(trigger.textContent).toContain("Fable 5.1");
		expect(trigger.textContent).toContain("Alto");
		expect(Object.hasOwn(trigger.dataset, "pending")).toBe(false);
	});

	test("tocar num modelo aplica, mantém o esforço compatível e o painel aberto", async () => {
		const changes: ModelTarget[] = [];
		renderPicker(SESSION, (target) => changes.push(target));
		const user = userEvent.setup();

		await user.click(screen.getByLabelText("Selecionar modelo da sessão"));
		expect(screen.getByRole("radio", { name: /Opus 5/ }).getAttribute("aria-checked")).toBe(
			"false",
		);
		expect(screen.getByRole("radio", { name: /Fable 5.1/ }).textContent).toContain("atual");

		await user.click(screen.getByRole("radio", { name: /Opus 5/ }));

		expect(changes).toEqual([{ cli: "claude", model: "opus", effort: "high" }]);
		expect(query("model-picker-panel")).not.toBeNull();
	});

	test("trocar de CLI zera o modelo, lista o catálogo da outra CLI e avisa a migração", async () => {
		const changes: ModelTarget[] = [];
		const { rerender } = renderPicker(SESSION, (target) => changes.push(target));
		const user = userEvent.setup();

		await user.click(screen.getByLabelText("Selecionar modelo da sessão"));
		await user.click(screen.getByRole("radio", { name: /Codex/ }));
		expect(changes).toEqual([{ cli: "codex", model: null, effort: null }]);

		rerender(
			<div data-theme-root>
				<ModelPicker
					catalog={CATALOG}
					session={SESSION}
					value={{ cli: "codex", model: null, effort: null }}
					onChange={(target) => changes.push(target)}
				/>
			</div>,
		);

		expect(Object.hasOwn(get("model-picker").dataset, "pending")).toBe(true);
		expect(get("model-picker-panel").textContent).toContain("continua em uma sessão Codex");
		expect(screen.getByRole("radio", { name: /GPT 6 Astra/ })).toBeTruthy();

		await user.click(screen.getByRole("radio", { name: "Ultra" }));
		expect(changes.at(-1)).toEqual({ cli: "codex", model: null, effort: "ultra" });
	});

	test("voltar para a CLI da sessão restaura o modelo e o esforço observados", async () => {
		const changes: ModelTarget[] = [];
		renderPicker({ cli: "codex", model: "gpt-6-astra", effort: "ultra" }, (target) =>
			changes.push(target),
		);
		const user = userEvent.setup();

		await user.click(screen.getByLabelText("Selecionar modelo da sessão"));
		await user.click(screen.getByRole("radio", { name: /Claude Code/ }));

		expect(changes).toEqual([SESSION]);
	});
});

test.each([true, false])(
	"permite escolher modelo e esforço antes de concluir (mobile: %s)",
	async (isMobile) => {
		const media = window.matchMedia("(max-width: 767px)");
		const mock = spyOn(window, "matchMedia").mockReturnValue(
			Object.defineProperty(media, "matches", { value: isMobile }),
		);
		const changes: ModelTarget[] = [];

		function Picker() {
			const [value, setValue] = useState<ModelTarget>(SESSION);

			return (
				<div data-theme-root>
					<ModelPicker
						catalog={{ ...CATALOG, claude: CATALOG.claude.toReversed() }}
						session={SESSION}
						value={value}
						onChange={(target) => {
							setValue(target);
							changes.push(target);
						}}
					/>
				</div>
			);
		}

		try {
			render(<Picker />);
			const user = userEvent.setup();
			await user.click(get("model-picker"));
			await user.click(slot(get("model-picker-panel"), "model"));
			expect(query("model-picker-panel")).not.toBeNull();
			await user.click(slot(get("model-picker-panel"), "effort"));
			expect(changes.at(-1)).toEqual({ ...SESSION, model: "opus", effort: "low" });
			expect(query("model-picker-panel")).not.toBeNull();
			await user.click(get("model-picker-done"));
			expect(query("model-picker-panel")).toBeNull();
			expect(get("model-picker").getAttribute("aria-expanded")).toBe("false");
		} finally {
			cleanup();
			mock.mockRestore();
		}
	},
);
