import { expect, test } from "bun:test";

import type { AgentSessionEvent } from "./agent-session";
import { recentTranscriptText, toTimelineGroups, trailStepLabel } from "./agent-timeline";

function event(seq: number, payload: AgentSessionEvent["payload"]): AgentSessionEvent {
	return { id: String(seq), sessionId: "pane", seq, at: seq, payload };
}

test("escolhe a última fala legível e ignora eventos operacionais", () => {
	const events = [
		event(1, { kind: "user", text: "primeira" }),
		event(2, { kind: "thinking", text: "pensando" }),
		event(3, { kind: "tool_use", name: "Bash", label: "Terminal", status: "ok" }),
		event(4, { kind: "assistant", text: "resposta" }),
		event(5, { kind: "result", status: "done" }),
	];

	expect(recentTranscriptText(events)).toBe("resposta");
});

test("ignora falas vazias e retorna null quando não há fala", () => {
	expect(recentTranscriptText([event(1, { kind: "assistant", text: "  " })])).toBeNull();
	expect(recentTranscriptText([event(1, { kind: "thinking", text: "x" })])).toBeNull();
});

test("trunca somente o texto de apresentação", () => {
	expect(recentTranscriptText([event(1, { kind: "user", text: "x".repeat(200) })])).toBe(
		`${"x".repeat(159)}…`,
	);
});

test("mantém a compactação como marco independente na timeline", () => {
	const compacted = event(2, {
		kind: "notice",
		label: "Contexto compactado",
		tone: "info",
	});
	const groups = toTimelineGroups([
		event(1, { kind: "assistant", text: "antes" }),
		compacted,
		event(3, { kind: "assistant", text: "depois" }),
	]);

	expect(groups).toHaveLength(3);
	expect(groups[1]).toEqual({ kind: "block", key: "2", event: compacted });
});

test("mantém um só rastro recolhido e as narrações visíveis", () => {
	const narration = event(2, { kind: "assistant", text: "Vou conferir os arquivos." });
	const answer = event(5, { kind: "assistant", text: "Concluído." });
	const groups = toTimelineGroups([
		event(1, { kind: "thinking", text: "pensando" }),
		narration,
		event(3, { kind: "tool_use", name: "Read", label: "Leitura", status: "ok" }),
		event(4, { kind: "thinking", text: "validando" }),
		answer,
	]);

	expect(groups.map(({ kind }) => kind)).toEqual(["trail", "narration", "block"]);
	expect(groups[0]).toMatchObject({ kind: "trail", total: 3 });
	expect(groups[1]).toEqual({ kind: "narration", key: "2", events: [narration] });
	expect(groups[2]).toEqual({ kind: "block", key: "5", event: answer });
});

test("junta narrações consecutivas no mesmo bloco", () => {
	const first = event(1, { kind: "assistant", text: "Primeira narração." });
	const second = event(2, { kind: "assistant", text: "Segunda narração." });
	const groups = toTimelineGroups([
		first,
		second,
		event(3, { kind: "tool_use", name: "Read", label: "Leitura", status: "ok" }),
	]);

	expect(groups).toEqual([
		expect.objectContaining({ kind: "trail", total: 1 }),
		{ kind: "narration", key: "1", events: [first, second] },
	]);
});

test("resume comandos pelo programa em vez de chamar tudo de Terminal", () => {
	expect(
		trailStepLabel(
			event(1, {
				kind: "tool_use",
				name: "exec",
				label: "Terminal",
				detail: "cd /repo && bun run typecheck",
				status: "ok",
			}),
		),
	).toBe("bun run typecheck");
});
