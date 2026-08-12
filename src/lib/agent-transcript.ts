import type { AgentEventPayload, AgentSessionEvent, AgentSessionPatch } from "@/lib/agent-session";

// O que um transcript no disco sabe produzir: a conversa, o desfecho de cada turno e, no claude, a
// pergunta estruturada (AskUserQuestion) com a resposta que o usuário escolheu. Permissão continua de
// fora porque o menu de aprovação nunca é gravado no arquivo.
export type TranscriptPatch =
	| Extract<AgentSessionPatch, { type: "append" | "settle" | "result" }>
	| { type: "answer"; toolUseId: string; text: string };

// O arquivo cresce por acréscimo e a leitura corta em qualquer byte: a linha partida no fim de um
// pedaço espera o próximo. Não há `flush` porque o fim do arquivo não é o fim da sessão.
export function createTranscriptParser(translate: (raw: unknown) => TranscriptPatch[]) {
	let pending = "";

	function line(value: string): TranscriptPatch[] {
		if (!value.trim()) {
			return [];
		}

		try {
			return translate(JSON.parse(value));
		} catch {
			return [];
		}
	}

	return {
		push(chunk: string): TranscriptPatch[] {
			const lines = `${pending}${chunk}`.split("\n");
			pending = lines.pop() ?? "";

			return lines.flatMap(line);
		},
		reset() {
			pending = "";
		},
	};
}

// O espelho de uma conversa lida do disco: dá `seq` a cada bloco e guarda a ferramenta em aberto
// para o resultado, que chega linhas depois, fechar o bloco certo em vez de virar um bloco novo.
export function createTranscriptMirror(sessionId: string, maxEvents = Number.POSITIVE_INFINITY) {
	let events: AgentSessionEvent[] = [];
	let seq = 0;
	const tools = new Map<string, AgentSessionEvent>();
	const questions = new Map<string, AgentSessionEvent[]>();

	function append(payload: AgentEventPayload) {
		const event = { id: crypto.randomUUID(), sessionId, seq, at: Date.now(), payload };
		seq += 1;
		events.push(event);

		if (events.length > maxEvents) {
			events = events.slice(-maxEvents);
		}

		return event;
	}

	function settle(patch: Extract<TranscriptPatch, { type: "settle" }>) {
		const target = tools.get(patch.toolUseId);
		if (!target || target.payload.kind !== "tool_use") {
			return null;
		}

		tools.delete(patch.toolUseId);
		const updated: AgentSessionEvent = {
			...target,
			payload: {
				...target.payload,
				status: patch.ok ? "ok" : "error",
				...(patch.detail ? { detail: patch.detail } : {}),
			},
		};
		events = events.map((event) => (event.seq === updated.seq ? updated : event));

		return updated;
	}

	// O texto da resposta chega como um `tool_result` único ("The user answered: \"Q\"=\"A\", ..."),
	// mesmo quando o bloco fez mais de uma pergunta: cada pergunta pesca a própria resposta pelo texto.
	function answeredValue(text: string, question: string) {
		const marker = `"${question}"="`;
		const start = text.indexOf(marker);
		if (start === -1) {
			return null;
		}

		const from = start + marker.length;
		const ends = [text.indexOf('", "', from), text.indexOf('".', from)].filter(
			(index) => index !== -1,
		);
		const end = ends.length > 0 ? Math.min(...ends) : text.lastIndexOf('"');

		return end > from ? text.slice(from, end) : null;
	}

	function answer(patch: Extract<TranscriptPatch, { type: "answer" }>) {
		const targets = questions.get(patch.toolUseId);
		if (!targets || targets.length === 0) {
			return [];
		}

		questions.delete(patch.toolUseId);
		const updates = targets.flatMap((target): AgentSessionEvent[] => {
			if (target.payload.kind !== "question" || target.payload.answers) {
				return [];
			}

			const value = answeredValue(patch.text, target.payload.question);
			const fallback = targets.length === 1 ? patch.text : null;
			const chosen = value ?? fallback;
			if (!chosen) {
				return [];
			}

			return [{ ...target, payload: { ...target.payload, answers: [chosen] } }];
		});

		if (updates.length === 0) {
			return [];
		}

		const bySeq = new Map(updates.map((event) => [event.seq, event]));
		events = events.map((event) => bySeq.get(event.seq) ?? event);

		return updates;
	}

	return {
		list() {
			return events;
		},

		reset() {
			events = [];
			tools.clear();
			questions.clear();
			seq = 0;
		},

		apply(patches: TranscriptPatch[]) {
			return patches.flatMap((patch): AgentSessionEvent[] => {
				if (patch.type === "settle") {
					const updated = settle(patch);

					return updated ? [updated] : [];
				}

				if (patch.type === "answer") {
					return answer(patch);
				}

				if (patch.type === "result") {
					return [
						append({
							kind: "result",
							status: patch.status,
							...(patch.durationMs ? { durationMs: patch.durationMs } : {}),
							...(patch.costUsd ? { costUsd: patch.costUsd } : {}),
							...(patch.error ? { error: patch.error } : {}),
						}),
					];
				}

				const event = append(patch.payload);
				if (patch.payload.kind === "tool_use" && patch.payload.toolUseId) {
					tools.set(patch.payload.toolUseId, event);
				}
				// O bloco de pergunta nasce do `tool_use` e a resposta chega pelo `tool_result` daquele
				// mesmo id: o `questionId` carrega o id da ferramenta (com `#n` quando há mais de uma).
				if (patch.payload.kind === "question") {
					const toolUseId = patch.payload.questionId.split("#")[0] ?? patch.payload.questionId;
					questions.set(toolUseId, [...(questions.get(toolUseId) ?? []), event]);
				}

				return [event];
			});
		},
	};
}
