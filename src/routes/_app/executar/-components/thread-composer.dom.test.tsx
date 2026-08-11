import { afterEach, describe, expect, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";

import type { AgentStep } from "@/lib/agent-stream";
import {
	cleanup,
	fireEvent,
	render,
	renderWithQuery,
} from "../../../../../tests/web/testing-library";
import { AgentSteps } from "./agent-steps";
import { ThreadComposer } from "@/components/agent-session/thread-composer";

afterEach(() => {
	cleanup();
	localStorage.clear();
});

function step(seq: number, overrides: Partial<AgentStep> = {}): AgentStep {
	return {
		seq,
		kind: "tool",
		label: `Passo ${seq}`,
		status: "ok",
		at: seq,
		...overrides,
	};
}

describe("ThreadComposer", () => {
	test("envia a continuação e limpa o campo", async () => {
		const sent: string[] = [];
		renderWithQuery(
			<div data-theme-root>
				<ThreadComposer
					draftKey="draft-teste"
					disabled={false}
					pending={false}
					hint=""
					onSubmit={(prompt) => {
						sent.push(prompt);
					}}
				/>
			</div>,
		);

		const field = screen.getByPlaceholderText("Responda ao agente nesta mesma sessão…");
		fireEvent.change(field, { target: { value: "  siga com o refactor  " } });
		fireEvent.click(screen.getByLabelText("Enviar continuação"));

		expect(sent).toEqual(["siga com o refactor"]);
		await waitFor(() => expect((field as HTMLTextAreaElement).value).toBe(""));
	});

	test("ctrl+enter envia sem passar pelo botão", async () => {
		const sent: string[] = [];
		renderWithQuery(
			<div data-theme-root>
				<ThreadComposer
					draftKey="draft-atalho"
					disabled={false}
					pending={false}
					hint=""
					onSubmit={(prompt) => {
						sent.push(prompt);
					}}
				/>
			</div>,
		);

		const field = screen.getByPlaceholderText("Responda ao agente nesta mesma sessão…");
		fireEvent.change(field, { target: { value: "continue daqui" } });
		fireEvent.keyDown(field, { key: "Enter", ctrlKey: true });

		expect(sent).toEqual(["continue daqui"]);
		await waitFor(() => expect((field as HTMLTextAreaElement).value).toBe(""));
	});

	test("preserva o rascunho quando o terminal rejeita o envio", async () => {
		renderWithQuery(
			<div data-theme-root>
				<ThreadComposer
					draftKey="draft-rejeitado"
					disabled={false}
					pending={false}
					hint=""
					onSubmit={() => Promise.resolve(false)}
				/>
			</div>,
		);

		const field = screen.getByPlaceholderText("Responda ao agente nesta mesma sessão…");
		fireEvent.change(field, { target: { value: "não perca este texto" } });
		fireEvent.click(screen.getByLabelText("Enviar continuação"));

		await waitFor(() => expect((field as HTMLTextAreaElement).value).toBe("não perca este texto"));
	});

	test("a borracha limpa o rascunho inteiro", () => {
		renderWithQuery(
			<div data-theme-root>
				<ThreadComposer
					draftKey="draft-limpeza"
					disabled={false}
					pending={false}
					hint=""
					onSubmit={() => {}}
				/>
			</div>,
		);

		const field = screen.getByPlaceholderText("Responda ao agente nesta mesma sessão…");
		fireEvent.change(field, { target: { value: "rascunho a descartar" } });
		fireEvent.click(screen.getByLabelText("Limpar tudo"));

		expect((field as HTMLTextAreaElement).value).toBe("");
	});

	test("bloqueia o envio enquanto o agente trabalha e explica o motivo", () => {
		const sent: string[] = [];
		renderWithQuery(
			<div data-theme-root>
				<ThreadComposer
					draftKey="draft-bloqueado"
					disabled
					pending={false}
					hint="O agente está trabalhando."
					onSubmit={(prompt) => {
						sent.push(prompt);
					}}
				/>
			</div>,
		);

		const field = screen.getByPlaceholderText("O agente está trabalhando.");
		fireEvent.change(field, { target: { value: "continue" } });
		fireEvent.click(screen.getByLabelText("Enviar continuação"));

		expect(sent).toEqual([]);
	});

	test("o menu sugere o comando da CLI e o enter despacha na hora", async () => {
		const sent: string[] = [];
		renderWithQuery(
			<div data-theme-root>
				<ThreadComposer
					draftKey="draft-comando"
					cli="claude"
					disabled={false}
					pending={false}
					hint=""
					onSubmit={(prompt) => {
						sent.push(prompt);
					}}
				/>
			</div>,
		);

		const field = screen.getByPlaceholderText("Responda ao agente nesta mesma sessão…");
		fireEvent.change(field, { target: { value: "/new", selectionStart: 4 } });

		expect(screen.getByText("/clear")).toBeTruthy();

		fireEvent.keyDown(field, { key: "Enter" });

		expect(sent).toEqual(["/clear"]);
		await waitFor(() => expect((field as HTMLTextAreaElement).value).toBe(""));
	});

	test("o tab completa o comando sem enviar", () => {
		const sent: string[] = [];
		renderWithQuery(
			<div data-theme-root>
				<ThreadComposer
					draftKey="draft-tab"
					cli="codex"
					disabled={false}
					pending={false}
					hint=""
					onSubmit={(prompt) => {
						sent.push(prompt);
					}}
				/>
			</div>,
		);

		const field = screen.getByPlaceholderText("Responda ao agente nesta mesma sessão…");
		fireEvent.change(field, { target: { value: "/appr", selectionStart: 5 } });
		fireEvent.keyDown(field, { key: "Tab" });

		expect((field as HTMLTextAreaElement).value).toBe("/approvals ");
		expect(sent).toEqual([]);
	});

	test("comando no meio do texto não vira sugestão de CLI", () => {
		renderWithQuery(
			<div data-theme-root>
				<ThreadComposer
					draftKey="draft-meio"
					cli="claude"
					disabled={false}
					pending={false}
					hint=""
					onSubmit={() => {}}
				/>
			</div>,
		);

		const field = screen.getByPlaceholderText("Responda ao agente nesta mesma sessão…");
		fireEvent.change(field, {
			target: { value: "reveja isso /new", selectionStart: 16 },
		});

		expect(screen.queryByText("/clear")).toBeNull();
	});

	test("adapta a escrita para uma sessão nova", () => {
		renderWithQuery(
			<div data-theme-root>
				<ThreadComposer
					draftKey="draft-nova-sessao"
					disabled={false}
					pending={false}
					hint=""
					placeholder="O que a nova sessão deve fazer?"
					helperText="A nova sessão lê a tarefa antes de começar."
					onSubmit={() => {}}
				/>
			</div>,
		);

		expect(screen.getByPlaceholderText("O que a nova sessão deve fazer?")).toBeTruthy();
		expect(screen.getByText("A nova sessão lê a tarefa antes de começar.")).toBeTruthy();
	});
});

describe("AgentSteps", () => {
	test("mostra só os passos recentes e revela o resto sob demanda", () => {
		render(
			<div data-theme-root>
				<AgentSteps
					steps={[step(1), step(2), step(3), step(4), step(5), step(6)]}
					running={false}
				/>
			</div>,
		);

		expect(screen.queryByText("Passo 1")).toBeNull();
		expect(screen.getByText("Passo 6")).toBeTruthy();

		fireEvent.click(screen.getByText("Mostrar os 2 passos anteriores"));

		expect(screen.getByText("Passo 1")).toBeTruthy();
	});

	test("avisa a espera enquanto o agente ainda não produziu passo algum", () => {
		render(
			<div data-theme-root>
				<AgentSteps steps={[]} running />
			</div>,
		);

		expect(screen.getByText("Aguardando o primeiro movimento do agente…")).toBeTruthy();
	});
});
