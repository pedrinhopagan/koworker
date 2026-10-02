import { afterEach, describe, expect, test } from "bun:test";
import { RefreshCw } from "lucide-react";

import { cleanup, render } from "../../../tests/web/testing-library";
import { ConfigCard } from "./config-card";

afterEach(cleanup);

describe("ConfigCard", () => {
	test("mantém o quadrado do ícone no mesmo tamanho", () => {
		const { container } = render(
			<ConfigCard icon={RefreshCw} title="Atualizar" description="Descrição" onClick={() => {}} />,
		);

		const wrapper = container.querySelector("button > span");
		expect(wrapper?.classList.contains("size-8")).toBe(true);
		expect(wrapper?.classList.contains("shrink-0")).toBe(true);
	});

	test("aplica a animação somente no ícone interno", () => {
		const { container } = render(
			<ConfigCard
				icon={RefreshCw}
				title="Atualizando"
				description="Descrição"
				onClick={() => {}}
				iconClassName="animate-spin"
			/>,
		);

		const wrapper = container.querySelector("button > span");
		const icon = wrapper?.querySelector("svg");
		expect(wrapper?.classList.contains("animate-spin")).toBe(false);
		expect(icon?.classList.contains("animate-spin")).toBe(true);
	});
});
