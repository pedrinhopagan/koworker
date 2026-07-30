import { describe, expect, it } from "bun:test";

import {
	resolveDeleteConfirmationClick,
	resolveDeleteConfirmButtonSize,
} from "./delete-confirm-button";

describe("resolveDeleteConfirmationClick", () => {
	it("ativa modo de confirmacao no primeiro clique", () => {
		expect(resolveDeleteConfirmationClick(false)).toEqual({
			confirming: true,
			shouldDelete: false,
		});
	});

	it("executa delete e reseta confirmacao no segundo clique", () => {
		expect(resolveDeleteConfirmationClick(true)).toEqual({
			confirming: false,
			shouldDelete: true,
		});
	});
});

describe("resolveDeleteConfirmButtonSize", () => {
	it("retorna configuracao xs reduzida", () => {
		expect(resolveDeleteConfirmButtonSize("xs")).toEqual({
			buttonSize: "icon-sm",
			iconClassName: "size-4 md:size-3",
			buttonClassName: "size-12 p-0 md:size-6",
		});
	});
});
