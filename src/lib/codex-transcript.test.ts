import { describe, expect, test } from "bun:test";

import { createTranscriptMirror } from "./agent-transcript";
import {
	codexTranscriptEffort,
	codexTranscriptModel,
	createCodexTranscriptTranslator,
	translateCodexTranscriptLine,
} from "./codex-transcript";

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

	test("o modelo do turno sai do turn_context", () => {
		expect(
			codexTranscriptModel({
				type: "turn_context",
				payload: { cwd: "/repo", model: "gpt-5.6-sol" },
			}),
		).toBe("gpt-5.6-sol");
		expect(
			codexTranscriptModel({ type: "event_msg", payload: { type: "agent_message" } }),
		).toBeNull();
	});
});

describe("createCodexTranscriptTranslator", () => {
	test("mensagem anunciada nos dois formatos vira um bloco só", () => {
		const { translate } = createCodexTranscriptTranslator();

		expect(
			translate({
				type: "event_msg",
				payload: {
					type: "item_completed",
					item: { type: "UserMessage", content: [{ type: "text", text: "Ajuste o parallax" }] },
				},
			}),
		).toEqual([{ type: "append", payload: { kind: "user", text: "Ajuste o parallax" } }]);

		expect(
			translate({
				type: "event_msg",
				payload: { type: "user_message", message: "Ajuste o parallax" },
			}),
		).toEqual([]);

		expect(
			translate({
				type: "event_msg",
				payload: {
					type: "item_completed",
					item: { type: "AgentMessage", content: [{ type: "Text", text: "Feito." }] },
				},
			}),
		).toEqual([{ type: "append", payload: { kind: "assistant", text: "Feito." } }]);

		expect(
			translate({
				type: "event_msg",
				payload: { type: "agent_message", message: "Feito." },
			}),
		).toEqual([]);
	});

	test("sem item_completed, os eventos legados continuam valendo", () => {
		const { translate } = createCodexTranscriptTranslator();

		expect(
			translate({
				type: "event_msg",
				payload: { type: "user_message", message: "Primeira fala" },
			}),
		).toEqual([{ type: "append", payload: { kind: "user", text: "Primeira fala" } }]);
	});

	test("o reset devolve o tradutor ao estado de arquivo novo", () => {
		const translator = createCodexTranscriptTranslator();

		translator.translate({
			type: "event_msg",
			payload: {
				type: "item_completed",
				item: { type: "UserMessage", content: [{ type: "text", text: "Olá" }] },
			},
		});
		translator.reset();

		expect(
			translator.translate({
				type: "event_msg",
				payload: { type: "user_message", message: "Depois do reset" },
			}),
		).toEqual([{ type: "append", payload: { kind: "user", text: "Depois do reset" } }]);
	});
});

const ASYNC_TITLE = "Em “copiar o arquivo”, você quer o conteúdo ou o arquivo como anexo?";

function asyncQuestionLines(callId: string, questions: { title: string; options: string[] }[]) {
	return [
		{
			type: "response_item",
			payload: {
				type: "function_call",
				name: "request_user_input_async",
				call_id: callId,
				arguments: JSON.stringify({ questions }),
			},
		},
		{
			type: "event_msg",
			payload: {
				type: "item_completed",
				item: {
					type: "AgentMessage",
					id: callId,
					content: [{ type: "Text", text: questions.map((entry) => entry.title).join("\n") }],
					phase: "final_answer",
					delivery: "async",
					questions,
				},
			},
		},
		{
			type: "response_item",
			payload: { type: "function_call_output", call_id: callId, output: '{"accepted":true}' },
		},
	];
}

function userItem(text: string) {
	return {
		type: "event_msg",
		payload: {
			type: "item_completed",
			item: { type: "UserMessage", content: [{ type: "text", text }] },
		},
	};
}

describe("desfecho do turno", () => {
	test("turno interrompido vira cancelado com a duração", () => {
		expect(
			translateCodexTranscriptLine({
				type: "event_msg",
				payload: { type: "turn_aborted", turn_id: "t1", reason: "interrupted", duration_ms: 8272 },
			}),
		).toEqual([{ type: "result", status: "cancelled", durationMs: 8272 }]);
	});

	test("task_complete carrega a duração quando existe", () => {
		expect(
			translateCodexTranscriptLine({
				type: "event_msg",
				payload: { type: "task_complete", turn_id: "t1", duration_ms: 138945 },
			}),
		).toEqual([{ type: "result", status: "done", durationMs: 138945 }]);
	});
});

describe("pergunta assíncrona", () => {
	test("a chamada e o aceite não viram passo, e a mensagem vira pergunta", () => {
		const { translate } = createCodexTranscriptTranslator();
		const [call, message, output] = asyncQuestionLines("call_a", [
			{ title: ASYNC_TITLE, options: ["Conteúdo para colar", "Arquivo como anexo"] },
		]);

		expect(translate(call)).toEqual([]);
		expect(translate(message)).toEqual([
			{
				type: "append",
				payload: {
					kind: "question",
					questionId: "call_a",
					question: ASYNC_TITLE,
					options: [{ label: "Conteúdo para colar" }, { label: "Arquivo como anexo" }],
					multiSelect: false,
					async: true,
				},
			},
		]);
		expect(translate(output)).toEqual([]);
	});

	test("várias perguntas ganham #n e a resposta citada responde cada uma", () => {
		const { translate } = createCodexTranscriptTranslator();
		const lines = asyncQuestionLines("call_b", [
			{ title: "Primeira?", options: ["A", "B"] },
			{ title: "Segunda?", options: ["C"] },
		]);
		const patches = lines.flatMap(translate);

		expect(
			patches.map(
				(patch) =>
					patch.type === "append" && patch.payload.kind === "question" && patch.payload.questionId,
			),
		).toEqual(["call_b#0", "call_b#1"]);
		expect(translate(userItem("> Primeira?\n\nB\n\n> Segunda?\n\nC"))).toEqual([
			{ type: "answer", toolUseId: "call_b", questionId: "call_b#0", text: "B" },
			{ type: "answer", toolUseId: "call_b", questionId: "call_b#1", text: "C" },
		]);
		expect(translate(userItem("> Primeira?\n\nB"))).toEqual([
			{ type: "append", payload: { kind: "user", text: "> Primeira?\n\nB" } },
		]);
	});

	test("texto que não é resposta sobra como fala do usuário", () => {
		const { translate } = createCodexTranscriptTranslator();
		asyncQuestionLines("call_c", [{ title: "Qual?", options: ["X"] }]).forEach(translate);

		expect(translate(userItem("> Outra citação\n\n> Qual?\n\nX"))).toEqual([
			{ type: "answer", toolUseId: "call_c", questionId: "call_c", text: "X" },
			{ type: "append", payload: { kind: "user", text: "> Outra citação" } },
		]);
	});

	test("o reset esquece a pergunta pendente", () => {
		const translator = createCodexTranscriptTranslator();
		asyncQuestionLines("call_d", [{ title: "Qual?", options: ["X"] }]).forEach(
			translator.translate,
		);
		translator.reset();

		expect(translator.translate(userItem("> Qual?\n\nX"))).toEqual([
			{ type: "append", payload: { kind: "user", text: "> Qual?\n\nX" } },
		]);
	});

	test("no espelho, a pergunta fica respondida e nenhum bloco user extra aparece", () => {
		const { translate } = createCodexTranscriptTranslator();
		const mirror = createTranscriptMirror("s1");
		const lines = [
			...asyncQuestionLines("call_e", [
				{ title: ASYNC_TITLE, options: ["Conteúdo para colar", "Arquivo como anexo"] },
			]),
			{
				type: "response_item",
				payload: {
					type: "message",
					role: "user",
					content: [{ type: "input_text", text: `> ${ASYNC_TITLE}\n\nArquivo como anexo` }],
				},
			},
			userItem(`> ${ASYNC_TITLE}\n\nArquivo como anexo`),
		];
		for (const line of lines) {
			mirror.apply(translate(line));
		}

		const events = mirror.list();
		expect(events).toHaveLength(1);
		expect(events[0]?.payload).toMatchObject({
			kind: "question",
			questionId: "call_e",
			async: true,
			answers: ["Arquivo como anexo"],
		});
	});
});

describe("pergunta bloqueante", () => {
	const call = {
		type: "response_item",
		payload: {
			type: "function_call",
			name: "request_user_input",
			call_id: "call_p",
			arguments: JSON.stringify({
				questions: [
					{
						header: "Agrupamento",
						id: "grouping",
						question: "Como agrupar?",
						options: [{ label: "Ordenar só", description: "Mantém o grupo" }, "Subgrupos"],
					},
					{ id: "mixed", title: "E a venda mista?" },
				],
			}),
		},
	};

	test("a chamada vira uma pergunta por item, e a saída responde pelo id", () => {
		const { translate } = createCodexTranscriptTranslator();

		expect(translate(call)).toEqual([
			{
				type: "append",
				payload: {
					kind: "question",
					questionId: "call_p#0",
					question: "Como agrupar?",
					options: [{ label: "Ordenar só", description: "Mantém o grupo" }, { label: "Subgrupos" }],
					multiSelect: false,
				},
			},
			{
				type: "append",
				payload: {
					kind: "question",
					questionId: "call_p#1",
					question: "E a venda mista?",
					options: [],
					multiSelect: false,
				},
			},
		]);

		expect(
			translate({
				type: "response_item",
				payload: {
					type: "function_call_output",
					call_id: "call_p",
					output: JSON.stringify({
						answers: {
							mixed: { answers: ["Ficar no grupo pai"] },
							grouping: { answers: ["Ordenar só", "Subgrupos"] },
						},
					}),
				},
			}),
		).toEqual([
			{ type: "answer", toolUseId: "call_p", questionId: "call_p#1", text: "Ficar no grupo pai" },
			{
				type: "answer",
				toolUseId: "call_p",
				questionId: "call_p#0",
				text: "Ordenar só, Subgrupos",
			},
		]);
	});

	test("saída que não parseia não vira nada", () => {
		const { translate } = createCodexTranscriptTranslator();
		translate(call);

		expect(
			translate({
				type: "response_item",
				payload: { type: "function_call_output", call_id: "call_p", output: "cancelado" },
			}),
		).toEqual([]);
	});
});

describe("modelo e esforço", () => {
	test("thread_settings_applied informa modelo e esforço", () => {
		const line = {
			type: "event_msg",
			payload: {
				type: "thread_settings_applied",
				thread_settings: { model: "gpt-5.6-sol", reasoning_effort: "low" },
			},
		};

		expect(codexTranscriptModel(line)).toBe("gpt-5.6-sol");
		expect(codexTranscriptEffort(line)).toBe("low");
		expect(codexTranscriptEffort({ type: "turn_context", payload: { effort: "high" } })).toBe(
			"high",
		);
	});
});
