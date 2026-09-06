import { afterEach, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { get, slot } from "../../../tests/web/dom";
import {
	act,
	cleanup,
	fireEvent,
	render,
	renderWithQuery,
} from "../../../tests/web/testing-library";
import { ThreadComposer } from "./thread-composer";
import { readPromptDraft, writePromptDraft } from "@/lib/prompt-draft";

afterEach(async () => {
	await cleanup();
	localStorage.clear();
});

test("troca de sessão isola e salva o rascunho antes de desmontar", () => {
	writePromptDraft("sessao-b", { text: "rascunho B", images: [] });
	const props = { disabled: false, pending: false, hint: "", onSubmit: () => {} };
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const view = render(<ThreadComposer draftKey="sessao-a" {...props} />, {
		wrapper: ({ children }) => (
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		),
	});
	fireEvent.change(slot(get("thread-composer"), "prompt-input"), {
		target: { value: "rascunho A" },
	});
	view.rerender(<ThreadComposer draftKey="sessao-b" {...props} />);
	expect((slot(get("thread-composer"), "prompt-input") as HTMLTextAreaElement).value).toBe(
		"rascunho B",
	);
	expect(readPromptDraft("sessao-a").text).toBe("rascunho A");
	view.rerender(<ThreadComposer draftKey="sessao-a" {...props} />);
	expect((slot(get("thread-composer"), "prompt-input") as HTMLTextAreaElement).value).toBe(
		"rascunho A",
	);
});

test("envio em andamento não duplica nem apaga o próximo rascunho", async () => {
	const response = Promise.withResolvers<boolean>();
	const sent: string[] = [];
	renderWithQuery(
		<ThreadComposer
			draftKey="sessao"
			disabled={false}
			pending={false}
			hint=""
			onSubmit={(text) => {
				sent.push(text);
				return response.promise;
			}}
		/>,
	);
	const composer = get("thread-composer");
	const field = slot(composer, "prompt-input");
	fireEvent.change(field, { target: { value: "primeira" } });
	fireEvent.click(slot(composer, "send"));
	fireEvent.click(slot(composer, "send"));
	fireEvent.change(field, { target: { value: "próxima mensagem" } });
	await act(async () => {
		response.resolve(true);
		await response.promise;
	});
	expect(sent).toEqual(["primeira"]);
	expect((field as HTMLTextAreaElement).value).toBe("próxima mensagem");
	expect(readPromptDraft("sessao").text).toBe("próxima mensagem");
});
