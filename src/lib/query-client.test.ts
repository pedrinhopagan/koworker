import { expect, test } from "bun:test";
import { onlineManager } from "@tanstack/react-query";

test("desktop consulta e grava no servidor local mesmo sem internet", async () => {
	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
	Object.defineProperty(globalThis, "window", { configurable: true, value: { kowork: {} } });
	const wasOnline = onlineManager.isOnline();
	const { queryClient } = await import("./query-client");
	onlineManager.setOnline(false);

	try {
		expect(queryClient.getDefaultOptions().mutations?.networkMode).toBe("always");
		const result = await queryClient.fetchQuery({
			queryKey: ["offline-local"],
			queryFn: () => "local",
		});
		expect(result).toBe("local");
		const mutation = queryClient.getMutationCache().build(queryClient, {
			mutationFn: (value: string) => Promise.resolve(value),
		});
		const saved = await mutation.execute("salvo");
		expect(saved).toBe("salvo");
	} finally {
		queryClient.clear();
		onlineManager.setOnline(wasOnline);
		if (originalWindow) {
			Object.defineProperty(globalThis, "window", originalWindow);
		} else {
			Reflect.deleteProperty(globalThis, "window");
		}
	}
});
