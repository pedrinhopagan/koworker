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
			iconClassName: "h-3 w-3",
			buttonClassName: "h-6 w-6 min-h-6 min-w-6 p-0",
		});
	});
});
