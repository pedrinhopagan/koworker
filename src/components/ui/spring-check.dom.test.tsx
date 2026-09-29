import { afterEach, describe, expect, mock, test } from "bun:test";
import { screen } from "@testing-library/react";

import { SpringCheck } from "@/components/ui/spring-check";
import { cleanup, fireEvent, render } from "../../../tests/web/testing-library";

afterEach(cleanup);

describe("SpringCheck", () => {
	test("expõe checkbox acessível e alterna no clique", () => {
		const onCheckedChange = mock((_checked: boolean) => {});
		render(<SpringCheck checked={false} onCheckedChange={onCheckedChange} aria-label="Concluir" />);

		const box = screen.getByRole("checkbox", { name: "Concluir" });
		expect(box.getAttribute("aria-checked")).toBe("false");

		fireEvent.click(box);
		expect(onCheckedChange).toHaveBeenCalledWith(true);
	});
});
