import { afterEach, describe, expect, test } from "bun:test";
import { screen } from "@testing-library/react";

import { ProjectPickerDialog } from "@/components/projects/project-picker-dialog";
import { cleanup, fireEvent, render } from "../../../tests/web/testing-library";

afterEach(cleanup);

const PROJECTS = [
	{ id: "a", name: "Alpha", color: null },
	{ id: "b", name: "Beta", color: null },
];

describe("ProjectPickerDialog", () => {
	test("navega pelas opções e confirma com o teclado", async () => {
		let picked = "";
		render(
			<div data-theme-root>
				<ProjectPickerDialog
					open
					onClose={() => {}}
					projects={PROJECTS}
					onSelect={(id) => {
						picked = id;
					}}
				/>
			</div>,
		);

		const options = await screen.findAllByRole("option");
		expect(options.map((option) => option.getAttribute("tabindex"))).toEqual(["0", "-1"]);

		const busca = screen.getByPlaceholderText("Buscar projeto…");
		expect(document.activeElement).toBe(busca);

		fireEvent.keyDown(busca, { key: "ArrowDown" });
		expect(document.activeElement).toBe(screen.getAllByRole("option")[1]);
		expect(screen.getAllByRole("option").map((option) => option.getAttribute("tabindex"))).toEqual([
			"-1",
			"0",
		]);

		fireEvent.keyDown(document.activeElement ?? busca, { key: "Enter" });
		expect(picked).toBe("b");
	});
});
