import { describe, expect, test } from "bun:test";

import { translateCodexTranscriptLine } from "./codex-transcript";

describe("translateCodexTranscriptLine", () => {
	test("a conversa sai dos eventos de interface", () => {
		expect(
			translateCodexTranscriptLine({
				timestamp: "2026-07-29T12:39:37.824Z",
				type: "event_msg",
				payload: { type: "user_message", message: "Ajuste o parallax do cenário", images: [] },
			}),
		).toEqual([
			{ type: "append", payload: { kind: "user", text: "Ajuste o parallax do cenário" } },
		]);

		expect(
			translateCodexTranscriptLine({
				type: "event_msg",
				payload: {
					type: "agent_message",
					message: "Vou ativar a memória do projeto.",
					phase: "commentary",
				},
			}),
		).toEqual([
			{ type: "append", payload: { kind: "assistant", text: "Vou ativar a memória do projeto." } },
		]);
	});

	test("a conversa atual sai dos itens concluídos sem expor o contexto injetado", () => {
		expect(
			translateCodexTranscriptLine({
				type: "event_msg",
				payload: {
					type: "item_completed",
					item: {
						type: "UserMessage",
						content: [{ type: "text", text: "Revise o WIP e deixe a PR pronta" }],
					},
				},
			}),
		).toEqual([
			{ type: "append", payload: { kind: "user", text: "Revise o WIP e deixe a PR pronta" } },
		]);

		expect(
			translateCodexTranscriptLine({
				type: "event_msg",
				payload: {
					type: "item_completed",
					item: {
						type: "AgentMessage",
						content: [{ type: "Text", text: "Vou revisar, validar e organizar os commits." }],
					},
				},
			}),
		).toEqual([
			{
				type: "append",
				payload: { kind: "assistant", text: "Vou revisar, validar e organizar os commits." },
			},
		]);

		expect(
			translateCodexTranscriptLine({
				type: "response_item",
				payload: {
					type: "message",
					role: "user",
					content: [{ type: "input_text", text: "# AGENTS.md injetado" }],
				},
			}),
		).toEqual([]);
	});

	test("a chamada de ferramenta mostra o comando, e a saída fecha o passo", () => {
		expect(
			translateCodexTranscriptLine({
				type: "response_item",
				payload: {
					type: "function_call",
					name: "exec_command",
					call_id: "call_1",
					arguments: '{"cmd":"bun run typecheck","workdir":"/repo","yield_time_ms":10000}',
				},
			}),
		).toEqual([
			{
				type: "append",
				payload: {
					kind: "tool_use",
					toolUseId: "call_1",
					name: "exec_command",
					label: "Terminal",
					status: "running",
					detail: "bun run typecheck",
				},
			},
		]);

		expect(
			translateCodexTranscriptLine({
				type: "response_item",
				payload: {
					type: "function_call_output",
					call_id: "call_1",
					output: "Wall time: 0.1 seconds\nProcess exited with code 0\nOutput:\nok",
				},
			}),
		).toEqual([{ type: "settle", toolUseId: "call_1", ok: true }]);
	});

	test("comando que falhou marca o passo com a saída", () => {
		const patches = translateCodexTranscriptLine({
			type: "response_item",
			payload: {
				type: "function_call_output",
				call_id: "call_2",
				output: "Process exited with code 1\nOutput:\nerro de tipo",
			},
		});

		expect(patches[0]).toMatchObject({ type: "settle", toolUseId: "call_2", ok: false });
	});

	test("a ferramenta livre carrega o comando dentro do JavaScript que ela executa", () => {
		expect(
			translateCodexTranscriptLine({
				type: "response_item",
				payload: {
					type: "custom_tool_call",
					name: "exec",
					call_id: "call_3",
					input:
						'const r = await tools.exec_command({"cmd":"git status","workdir":"/repo"}); text(r.output);',
				},
			}),
		).toEqual([
			{
				type: "append",
				payload: {
					kind: "tool_use",
					toolUseId: "call_3",
					name: "exec",
					label: "Terminal",
					status: "running",
					detail: "git status",
				},
			},
		]);
	});

	test("o patch aplicado mostra os arquivos que ele toca", () => {
		expect(
			translateCodexTranscriptLine({
				type: "response_item",
				payload: {
					type: "custom_tool_call",
					name: "apply_patch",
					call_id: "call_4",
					input:
						"*** Begin Patch\n*** Update File: /repo/src/cena.tsx\n@@\n-antes\n+depois\n*** End Patch",
				},
			}),
		).toEqual([
			{
				type: "append",
				payload: {
					kind: "tool_use",
					toolUseId: "call_4",
					name: "apply_patch",
					label: "Alterar arquivos",
					status: "running",
					detail: "/repo/src/cena.tsx",
				},
			},
		]);
	});

	test("o fim do turno e o erro viram desfecho", () => {
		expect(
			translateCodexTranscriptLine({
				type: "event_msg",
				payload: { type: "task_complete", turn_id: "t1", last_agent_message: "Pronto." },
			}),
		).toEqual([{ type: "result", status: "done" }]);

		expect(
			translateCodexTranscriptLine({
				type: "event_msg",
				payload: { type: "error", message: "conexão perdida" },
			}),
		).toEqual([{ type: "result", status: "failed", error: "conexão perdida" }]);
	});

	test("a compactação vira um marco da sessão", () => {
		expect(
			translateCodexTranscriptLine({
				type: "compacted",
				payload: { replacement_history: [], window_number: 2 },
			}),
		).toEqual([
			{
				type: "append",
				payload: {
					kind: "notice",
					label: "Contexto compactado",
					detail: "O agente resumiu o contexto e continuou nesta mesma sessão.",
					tone: "info",
				},
			},
		]);
	});

	test("o raciocínio cifrado e a configuração do turno ficam fora", () => {
		expect(
			translateCodexTranscriptLine({
				type: "response_item",
				payload: { type: "reasoning", id: "rs_1", summary: [], encrypted_content: "gAAAAA" },
			}),
		).toEqual([]);

		expect(
			translateCodexTranscriptLine({
				type: "turn_context",
				payload: { cwd: "/repo", model: "gpt-5.6" },
			}),
		).toEqual([]);
	});
});
