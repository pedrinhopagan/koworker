import { afterEach, describe, expect, mock, test } from "bun:test";
import { screen } from "@testing-library/react";

import { SlideCommit } from "@/components/ui/slide-commit";
import { cleanup, fireEvent, render, waitFor } from "../../../tests/web/testing-library";

afterEach(cleanup);

describe("SlideCommit", () => {
	test("Enter no puxador confirma e erro volta com a mensagem", async () => {
		const onConfirm = mock(() => Promise.reject(new Error("falhou")));
		render(
			<SlideCommit
				label="Mergear PR"
				pendingLabel="Mergeando PR"
				onConfirm={onConfirm}
				describeError={() => "Não foi possível despachar o merge"}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /Mergear PR/ }), { detail: 0 });

		expect(onConfirm).toHaveBeenCalledTimes(1);
		await waitFor(() =>
			expect(screen.getAllByText("Não foi possível despachar o merge").length).toBeGreaterThan(0),
		);
		expect(screen.getByRole("button", { name: /Mergear PR/ }).hasAttribute("disabled")).toBe(false);
	});

	test("clique de ponteiro sem deslizar não confirma", () => {
		const onConfirm = mock(() => Promise.resolve());
		render(
			<SlideCommit
				label="Mergear PR"
				pendingLabel="Mergeando PR"
				onConfirm={onConfirm}
				describeError={() => ""}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /Mergear PR/ }), { detail: 1 });

		expect(onConfirm).not.toHaveBeenCalled();
	});
});
