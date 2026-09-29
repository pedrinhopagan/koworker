import { beforeEach, describe, expect, it } from "bun:test";

import { toast, useToastStore } from "./toast";

describe("toast", () => {
	beforeEach(() => {
		useToastStore.setState({ toasts: [] });
	});

	it("empilha toasts sem id", () => {
		toast.success("um");
		toast.error("dois");

		expect(useToastStore.getState().toasts.map((entry) => entry.message)).toEqual(["um", "dois"]);
	});

	it("atualiza no lugar quando o id se repete", () => {
		toast.info("antes");
		toast.error("primeiro", { id: "fixo" });
		toast.warning("depois", { id: "fixo", description: "detalhe" });

		const toasts = useToastStore.getState().toasts;

		expect(toasts).toHaveLength(2);
		expect(toasts[1]).toMatchObject({
			id: "fixo",
			kind: "warning",
			message: "depois",
			description: "detalhe",
			version: 1,
		});
	});

	it("dispensa pelo id", () => {
		const id = toast.success("some");
		useToastStore.getState().dismiss(id);

		expect(useToastStore.getState().toasts).toEqual([]);
	});
});
