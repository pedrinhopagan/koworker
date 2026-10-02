import { afterEach, describe, expect, test } from "bun:test";
import { screen } from "@testing-library/react";

import { useState } from "react";

import type { CliModelOption, ModelCatalog } from "@/api/schemas/agent-radar";
import type { ModelTarget } from "@/lib/model-target";
import { get, query, slot } from "../../../tests/web/dom";
import { cleanup, render, userEvent } from "../../../tests/web/testing-library";
import { type ModelApplyStatus, ModelPicker } from "./model-picker";

afterEach(() => cleanup());

function option(
	id: string,
	label: string,
	efforts: string[],
	extra: Partial<CliModelOption> = {},
): CliModelOption {
	return { id, label, hint: "", efforts, defaultEffort: null, legacy: false, ...extra };
}

const CATALOG: ModelCatalog = {
	claude: [
		option("claude-opus-4-6", "Opus 4.6", ["low", "high"], { legacy: true }),
		option("claude-fable-5-1", "Fable 5.1", ["low", "medium", "high", "max"], {
			hint: "Mais capaz",
		}),
		option("claude-haiku-4-5", "Haiku 4.5", []),
	],
	codex: [
		option("gpt-6-astra", "GPT-6-Astra", ["medium", "high", "ultra"], { defaultEffort: "medium" }),
	],
};

const SESSION = { cli: "claude" as const, model: "claude-fable-5-1", effort: "high" };

function Picker({
	initial = SESSION,
	status = "idle",
	changes,
}: {
	initial?: ModelTarget;
	status?: ModelApplyStatus;
	changes: ModelTarget[];
}) {
	const [value, setValue] = useState<ModelTarget>(initial);

	return (
		<div data-theme-root>
			<ModelPicker
				catalog={CATALOG}
				session={SESSION}
				value={value}
				status={status}
				onChange={(target) => {
					setValue(target);
					changes.push(target);
				}}
			/>
		</div>
	);
}

describe("ModelPicker", () => {
	test("mostra modelo e esforço da sessão nos dois chips, sem pendência", () => {
		render(<Picker changes={[]} />);

		expect(get("model-picker").textContent).toContain("Fable 5.1");
		expect(screen.getByLabelText("Escolher esforço").textContent).toContain("Alto");
		expect(Object.hasOwn(get("model-picker").dataset, "pending")).toBe(false);
	});

	test("lista principais antes das versões anteriores e aplica o modelo ao tocar", async () => {
		const changes: ModelTarget[] = [];
		render(<Picker changes={changes} />);
		const user = userEvent.setup();

		await user.click(screen.getByLabelText("Escolher modelo"));
		const rows = screen.getAllByRole("option");
		expect(rows.map((row) => row.dataset.value)).toEqual([
			"claude-fable-5-1",
			"claude-haiku-4-5",
			"claude-opus-4-6",
		]);
		expect(rows[0]!.textContent).toContain("atual");
		expect(get("model-picker-panel").textContent).toContain("Versões anteriores");

		await user.click(screen.getByRole("option", { name: /Opus 4.6/ }));

		expect(changes).toEqual([{ cli: "claude", model: "claude-opus-4-6", effort: "high" }]);
		expect(query("model-picker-panel")).toBeNull();
	});

	test("modelo sem esforço some com o chip de esforço", async () => {
		const changes: ModelTarget[] = [];
		render(<Picker changes={changes} />);
		const user = userEvent.setup();

		await user.click(screen.getByLabelText("Escolher modelo"));
		await user.click(screen.getByRole("option", { name: /Haiku/ }));

		expect(changes).toEqual([{ cli: "claude", model: "claude-haiku-4-5", effort: null }]);
		expect(screen.queryByLabelText("Escolher esforço")).toBeNull();
	});

	test("teclado navega a lista a partir do chip, como no prompt bar", async () => {
		const changes: ModelTarget[] = [];
		render(<Picker changes={changes} />);
		const user = userEvent.setup();

		screen.getByLabelText("Escolher modelo").focus();
		await user.keyboard("{Enter}");
		expect(query("model-picker-panel")).not.toBeNull();
		await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

		expect(changes.at(-1)?.model).toBe("claude-opus-4-6");
	});

	test("esforço muda pelos degraus e pelo teclado do trilho", async () => {
		const changes: ModelTarget[] = [];
		render(<Picker changes={changes} />);
		const user = userEvent.setup();

		await user.click(screen.getByLabelText("Escolher esforço"));
		const panel = get("effort-panel");
		expect(Object.hasOwn(panel.dataset, "max")).toBe(false);
		await user.click(slot(panel, "effort-slider"));
		await user.click(screen.getByRole("button", { name: "Máximo" }));
		expect(changes.at(-1)).toEqual({ ...SESSION, effort: "max" });
		expect(Object.hasOwn(get("effort-panel").dataset, "max")).toBe(true);

		screen.getByRole("slider").focus();
		await user.keyboard("{ArrowLeft}");
		expect(changes.at(-1)).toEqual({ ...SESSION, effort: "high" });
	});

	test("trocar de CLI fica pendente para o envio e avisa a migração", async () => {
		const changes: ModelTarget[] = [];
		render(<Picker changes={changes} />);
		const user = userEvent.setup();

		await user.click(screen.getByLabelText("Escolher modelo"));
		await user.click(screen.getByRole("radio", { name: /Codex/ }));

		expect(changes).toEqual([{ cli: "codex", model: null, effort: null }]);
		expect(Object.hasOwn(get("model-picker").dataset, "pending")).toBe(true);
		expect(get("model-picker-panel").textContent).toContain("continua em uma sessão Codex");

		await user.click(screen.getByRole("radio", { name: /Claude Code/ }));
		expect(changes.at(-1)).toEqual(SESSION);
	});

	test("anuncia aplicando, aplicado e falhou", () => {
		const { rerender } = render(<Picker changes={[]} status="applying" />);
		expect(screen.getByRole("status").textContent).toBe("Aplicando no terminal…");
		rerender(<Picker changes={[]} status="applied" />);
		expect(screen.getByRole("status").textContent).toBe("Aplicado nesta sessão");
		rerender(<Picker changes={[]} status="failed" />);
		expect(screen.getByRole("status").textContent).toBe("A troca falhou");
	});
});
