import { describe, expect, test } from "bun:test";

import { createTranscriptMirror, createTranscriptParser } from "./agent-transcript";
import {
	claudeTranscriptEffort,
	claudeTranscriptModel,
	translateClaudeTranscriptLine,
} from "./claude-transcript";

describe("translateClaudeTranscriptLine", () => {
	test("a fala do usuário é o texto puro da linha", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "user",
				isSidechain: false,
				message: { role: "user", content: "Corrija os acentos na digitação" },
				cwd: "/mnt/data/Projects/grind",
			}),
		).toEqual([
			{ type: "append", payload: { kind: "user", text: "Corrija os acentos na digitação" } },
		]);
	});

	test("preserva fala do usuário que veio com imagem em blocos", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "user",
				isSidechain: false,
				message: {
					role: "user",
					content: [
						{ type: "text", text: "Corrija o gráfico desta tela" },
						{ type: "image", source: { type: "base64", data: "..." } },
					],
				},
			}),
		).toEqual([
			{
				type: "append",
				payload: { kind: "user", text: "Corrija o gráfico desta tela", images: 1 },
			},
		]);
	});

	test("o comando de skill vira o que o usuário leria: nome mais argumentos", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "user",
				message: {
					role: "user",
					content:
						"<command-message>kw</command-message>\n<command-name>/kw</command-name>\n<command-args>Execute o plano</command-args>",
				},
			}),
		).toEqual([{ type: "append", payload: { kind: "user", text: "/kw Execute o plano" } }]);
	});

	test("o lembrete de sistema sai da fala", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "user",
				message: {
					role: "user",
					content: "Suba o servidor<system-reminder>não responda a este lembrete</system-reminder>",
				},
			}),
		).toEqual([{ type: "append", payload: { kind: "user", text: "Suba o servidor" } }]);
	});

	test("injeção do próprio CLI e bloco de subagente ficam fora da conversa", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "user",
				isMeta: true,
				message: { role: "user", content: "<local-command-caveat>Caveat…</local-command-caveat>" },
			}),
		).toEqual([]);

		expect(
			translateClaudeTranscriptLine({
				type: "assistant",
				isSidechain: true,
				message: { content: [{ type: "text", text: "resposta do subagente" }] },
			}),
		).toEqual([]);
	});

	test("o resumo automático da compactação não se passa pelo usuário", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "user",
				isCompactSummary: true,
				message: { role: "user", content: "This session is being continued..." },
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

	test("o turno do agente vira fala e ferramenta, e o resultado fecha a ferramenta", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "assistant",
				isSidechain: false,
				message: {
					model: "claude-opus-5",
					content: [
						{ type: "text", text: "Vou ler o arquivo." },
						{
							type: "tool_use",
							id: "toolu_1",
							name: "Read",
							input: { file_path: "/repo/src/app.ts" },
						},
					],
				},
			}),
		).toEqual([
			{ type: "append", payload: { kind: "assistant", text: "Vou ler o arquivo." } },
			{
				type: "append",
				payload: {
					kind: "tool_use",
					name: "Read",
					label: "Ler arquivo",
					status: "running",
					toolUseId: "toolu_1",
					detail: "/repo/src/app.ts",
				},
			},
		]);

		expect(
			translateClaudeTranscriptLine({
				type: "user",
				message: {
					role: "user",
					content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "1\timport…" }],
				},
				toolUseResult: { filePath: "/repo/src/app.ts" },
			}),
		).toEqual([{ type: "settle", toolUseId: "toolu_1", ok: true }]);
	});

	test("AskUserQuestion vira bloco de pergunta com as opções, não passo de ferramenta", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "assistant",
				message: {
					model: "claude-opus-5",
					content: [
						{
							type: "tool_use",
							id: "toolu_q",
							name: "AskUserQuestion",
							input: {
								questions: [
									{
										question: "Qual direção seguir?",
										header: "Direção",
										multiSelect: false,
										options: [{ label: "Neutro", description: "Risco zero" }, { label: "Radical" }],
									},
								],
							},
						},
					],
				},
			}),
		).toEqual([
			{
				type: "append",
				payload: {
					kind: "question",
					questionId: "toolu_q",
					question: "Qual direção seguir?",
					options: [{ label: "Neutro", description: "Risco zero" }, { label: "Radical" }],
					multiSelect: false,
				},
			},
		]);
	});

	test("a resposta do usuário à pergunta vira patch de answer", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "user",
				message: {
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "toolu_q",
							content:
								'The user answered: "Qual direção seguir?"="Neutro". Read the answers carefully — follow what they actually say.',
						},
					],
				},
			}),
		).toEqual([
			{ type: "answer", toolUseId: "toolu_q", text: '"Qual direção seguir?"="Neutro".' },
			{ type: "settle", toolUseId: "toolu_q", ok: true },
		]);
	});

	test("o modelo sai da linha assistant e ignora resposta sintética e subagente", () => {
		expect(
			claudeTranscriptModel({
				type: "assistant",
				message: { model: "claude-opus-5", content: [] },
			}),
		).toBe("claude-opus-5");
		expect(
			claudeTranscriptModel({ type: "assistant", message: { model: "<synthetic>", content: [] } }),
		).toBeNull();
		expect(
			claudeTranscriptModel({
				type: "assistant",
				isSidechain: true,
				message: { model: "claude-haiku-4-5-20251001", content: [] },
			}),
		).toBeNull();
		expect(claudeTranscriptModel({ type: "user", message: { content: "oi" } })).toBeNull();
	});

	test("linha de serviço do arquivo não vira bloco", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "queue-operation",
				operation: "enqueue",
				content: "/kw Execute o plano",
			}),
		).toEqual([{ type: "queue", op: "enqueue", text: "/kw Execute o plano" }]);

		expect(
			translateClaudeTranscriptLine({ type: "attachment", attachment: { type: "hook_success" } }),
		).toEqual([]);
	});
});

test("fala colada no terminal remove apenas o invólucro pasted_content", () => {
	expect(
		translateClaudeTranscriptLine({
			type: "user",
			message: {
				content: '<pasted_content id="abc">Linha um\nLinha dois</pasted_content id="abc">',
			},
		}),
	).toEqual([{ type: "append", payload: { kind: "user", text: "Linha um\nLinha dois" } }]);
});

describe("fila e eventos do terminal do claude", () => {
	test("a fila acompanha enqueue, absorção no meio do turno e dequeue", () => {
		const mirror = createTranscriptMirror("pane");
		const parser = createTranscriptParser(translateClaudeTranscriptLine);
		const lines = [
			{ type: "queue-operation", operation: "enqueue", content: "Primeira na fila" },
			{
				type: "queue-operation",
				operation: "enqueue",
				content: "<task-notification>\n<status>completed</status>\n</task-notification>",
			},
			{ type: "queue-operation", operation: "enqueue", content: "Segunda na fila" },
		];
		mirror.apply(parser.push(`${lines.map((line) => JSON.stringify(line)).join("\n")}\n`));

		expect(mirror.queued()).toEqual(["Primeira na fila", "Segunda na fila"]);

		mirror.apply(
			parser.push(
				`${[
					{ type: "queue-operation", operation: "remove", content: "Segunda na fila" },
					{
						type: "attachment",
						attachment: {
							type: "queued_command",
							prompt: "Segunda na fila",
							commandMode: "prompt",
							origin: { kind: "human" },
						},
					},
				]
					.map((line) => JSON.stringify(line))
					.join("\n")}\n`,
			),
		);

		expect(mirror.queued()).toEqual(["Primeira na fila"]);
		expect(mirror.list().map((event) => event.payload)).toEqual([
			{ kind: "user", text: "Segunda na fila" },
		]);

		mirror.apply(
			parser.push(`${JSON.stringify({ type: "queue-operation", operation: "dequeue" })}\n`),
		);

		expect(mirror.queued()).toEqual([]);
	});

	test("notificação de tarefa em segundo plano vira aviso, não fala do usuário", () => {
		const notification =
			'<task-notification>\n<task-id>a1</task-id>\n<status>failed</status>\n<summary>Agent "QA" failed</summary>\n</task-notification>';

		expect(
			translateClaudeTranscriptLine({
				type: "user",
				message: { role: "user", content: notification },
			}),
		).toEqual([
			{
				type: "append",
				payload: {
					kind: "notice",
					label: "Tarefa em segundo plano falhou",
					detail: 'Agent "QA" failed',
					tone: "error",
				},
			},
		]);
		expect(
			translateClaudeTranscriptLine({
				type: "attachment",
				attachment: {
					type: "queued_command",
					prompt: notification.replace("failed</status>", "completed</status>"),
					commandMode: "task-notification",
				},
			}),
		).toMatchObject([
			{ type: "append", payload: { kind: "notice", label: "Tarefa em segundo plano concluída" } },
		]);
	});

	test("saída de comando local, interrupção, duração do turno e erro da API", () => {
		expect(
			translateClaudeTranscriptLine({
				type: "user",
				message: {
					role: "user",
					content:
						"<local-command-stdout>Set model to \u001B[1mOpus\u001B[22m</local-command-stdout>",
				},
			}),
		).toEqual([
			{
				type: "append",
				payload: {
					kind: "notice",
					label: "Saída do comando",
					detail: "Set model to Opus",
					tone: "info",
				},
			},
		]);
		expect(
			translateClaudeTranscriptLine({
				type: "system",
				subtype: "local_command",
				content: "<local-command-stdout></local-command-stdout>",
				commandRun: { command: "clear" },
			}),
		).toEqual([]);
		expect(
			translateClaudeTranscriptLine({
				type: "user",
				message: {
					role: "user",
					content: [{ type: "text", text: "[Request interrupted by user]" }],
				},
			}),
		).toEqual([{ type: "result", status: "cancelled" }]);
		expect(
			translateClaudeTranscriptLine({ type: "system", subtype: "turn_duration", durationMs: 4200 }),
		).toEqual([{ type: "result", status: "done", durationMs: 4200 }]);
		expect(
			translateClaudeTranscriptLine({
				type: "assistant",
				isApiErrorMessage: true,
				message: {
					model: "<synthetic>",
					content: [{ type: "text", text: "API Error: 529 Overloaded" }],
				},
			}),
		).toEqual([
			{
				type: "append",
				payload: {
					kind: "notice",
					label: "Erro da API",
					detail: "API Error: 529 Overloaded",
					tone: "error",
				},
			},
		]);
	});
});

test("um /model ou /effort digitado no terminal troca modelo e esforço na hora", () => {
	const stdout = (text: string) => ({
		type: "user",
		message: { role: "user", content: `<local-command-stdout>${text}</local-command-stdout>` },
	});

	expect(
		claudeTranscriptModel(
			stdout("Set model to `Sonnet 5` for this session only with `low` effort"),
		),
	).toBe("Sonnet 5");
	expect(
		claudeTranscriptEffort(
			stdout("Set model to `Sonnet 5` for this session only with `low` effort"),
		),
	).toBe("low");
	expect(claudeTranscriptModel(stdout("Set model to Haiku 4.5 for this session only"))).toBe(
		"Haiku 4.5",
	);
	expect(
		claudeTranscriptEffort(
			stdout("Set effort level to medium (this session only): Balanced approach"),
		),
	).toBe("medium");
	expect(
		claudeTranscriptModel(stdout("Set effort level to medium (this session only)")),
	).toBeNull();
	expect(claudeTranscriptModel(stdout("Kept model as Sonnet 5"))).toBeNull();
});
