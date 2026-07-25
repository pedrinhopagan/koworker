import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, renderHook, waitFor } from "../../../../../tests/web/testing-library";
import {
	type SkillDocumentSnapshot,
	useSkillDocumentAutosave,
} from "./use-skill-document-autosave";

type Deferred<T> = {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (error: Error) => void;
};

function deferred<T>(): Deferred<T> {
	let resolve = (_value: T) => {};
	let reject = (_error: Error) => {};
	const promise = new Promise<T>((promiseResolve, promiseReject) => {
		resolve = promiseResolve;
		reject = promiseReject;
	});

	return { promise, resolve, reject };
}

function document(variantPath = "/one/SKILL.md"): SkillDocumentSnapshot {
	return { variantPath, description: "Inicial", metadata: {}, content: "Body" };
}

afterEach(cleanup);

describe.serial("useSkillDocumentAutosave", () => {
	test("serializa writes e usa o hash devolvido pelo write anterior", async () => {
		const first = deferred<{ skillHash: string }>();
		const second = deferred<{ skillHash: string }>();
		const calls: { expectedSkillHash: string; content: string }[] = [];
		const save = (input: SkillDocumentSnapshot & { expectedSkillHash: string }) => {
			calls.push({ expectedSkillHash: input.expectedSkillHash, content: input.content });
			return calls.length === 1 ? first.promise : second.promise;
		};
		const { result } = renderHook(() =>
			useSkillDocumentAutosave({ initialDocument: document(), initialSkillHash: "hash-1", save }),
		);

		act(() => result.current.schedule({ content: "Primeiro" }, true));
		await waitFor(() => expect(calls).toHaveLength(1));
		act(() => result.current.schedule({ content: "Segundo" }, true));
		expect(calls).toHaveLength(1);

		first.resolve({ skillHash: "hash-2" });
		await waitFor(() => expect(calls).toHaveLength(2));
		expect(calls[1]).toEqual({ expectedSkillHash: "hash-2", content: "Segundo" });
		second.resolve({ skillHash: "hash-3" });
		await act(async () => await result.current.flush());
		expect(result.current.status).toBe("saved");
	});

	test("mantém o draft e permite retry depois de erro", async () => {
		let attempts = 0;
		const save = async () => {
			await Promise.resolve();
			attempts += 1;
			if (attempts === 1) {
				throw new Error("falhou");
			}
			return { skillHash: "hash-2" };
		};
		const { result } = renderHook(() =>
			useSkillDocumentAutosave({ initialDocument: document(), initialSkillHash: "hash-1", save }),
		);

		act(() => result.current.schedule({ description: "Draft preservado" }));
		const captured: { error?: Error } = {};
		await act(async () => {
			try {
				await result.current.flush();
			} catch (caught) {
				if (caught instanceof Error) {
					captured.error = caught;
					return;
				}
				throw caught;
			}
		});
		expect(captured.error).toBeInstanceOf(Error);
		if (!captured.error) {
			throw new Error("Flush deveria falhar");
		}
		expect(captured.error.message).toBe("falhou");
		expect(result.current.document.description).toBe("Draft preservado");
		await waitFor(() => expect(result.current.status).toBe("error"));

		await act(async () => await result.current.flush());
		expect(attempts).toBe(2);
		expect(result.current.status).toBe("saved");
	});

	test("descarta a resposta residual ao trocar a variante", async () => {
		const first = deferred<{ skillHash: string }>();
		const calls: string[] = [];
		const save = async (input: SkillDocumentSnapshot & { expectedSkillHash: string }) => {
			calls.push(input.expectedSkillHash);
			if (calls.length === 1) {
				return await first.promise;
			}
			return { skillHash: "hash-new-2" };
		};
		const { result, rerender } = renderHook(
			({ initialDocument, initialSkillHash }) =>
				useSkillDocumentAutosave({ initialDocument, initialSkillHash, save }),
			{ initialProps: { initialDocument: document(), initialSkillHash: "hash-1" } },
		);

		act(() => result.current.schedule({ content: "Em voo" }, true));
		await waitFor(() => expect(calls).toHaveLength(1));
		rerender({ initialDocument: document("/two/SKILL.md"), initialSkillHash: "hash-new" });
		first.resolve({ skillHash: "hash-old-response" });
		await act(async () => await first.promise);
		expect(result.current.document.variantPath).toBe("/two/SKILL.md");

		act(() => result.current.schedule({ content: "Nova" }, true));
		await waitFor(() => expect(calls).toHaveLength(2));
		expect(calls[1]).toBe("hash-new");
	});

	test("ignora erro residual da variante anterior", async () => {
		const oldRequest = deferred<{ skillHash: string }>();
		const save = async () => await oldRequest.promise;
		const { result, rerender } = renderHook(
			({ initialDocument, initialSkillHash }) =>
				useSkillDocumentAutosave({ initialDocument, initialSkillHash, save }),
			{ initialProps: { initialDocument: document(), initialSkillHash: "hash-1" } },
		);

		act(() => result.current.schedule({ content: "Antiga" }, true));
		rerender({ initialDocument: document("/two/SKILL.md"), initialSkillHash: "hash-new" });
		oldRequest.reject(new Error("resposta antiga"));
		await act(async () => {
			await oldRequest.promise.catch(() => {});
		});

		expect(result.current.document.variantPath).toBe("/two/SKILL.md");
		expect(result.current.status).toBe("idle");
		expect(result.current.pending).toBe(false);
	});

	test("unmount dispara o write pendente do debounce", async () => {
		const calls: string[] = [];
		const { result, unmount } = renderHook(() =>
			useSkillDocumentAutosave({
				initialDocument: document(),
				initialSkillHash: "hash-1",
				save: async (input) => {
					await Promise.resolve();
					calls.push(input.content);
					return { skillHash: "hash-2" };
				},
				debounceMs: 10_000,
			}),
		);

		act(() => result.current.schedule({ content: "Antes de desmontar" }));
		unmount();
		await waitFor(() => expect(calls).toEqual(["Antes de desmontar"]));
	});
});
