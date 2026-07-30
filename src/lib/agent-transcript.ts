import type { AgentEventPayload, AgentSessionEvent, AgentSessionPatch } from "@/lib/agent-session";

// O que um transcript no disco sabe produzir: a conversa e o desfecho de cada turno. Permissão e
// pergunta não entram porque o arquivo é o registro do que já aconteceu, não um canal de resposta.
export type TranscriptPatch = Extract<AgentSessionPatch, { type: "append" | "settle" | "result" }>;

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
export function createTranscriptMirror(sessionId: string, maxEvents: number) {
	let events: AgentSessionEvent[] = [];
	let seq = 0;
	const tools = new Map<string, AgentSessionEvent>();

	function append(payload: AgentEventPayload) {
		const event = { id: crypto.randomUUID(), sessionId, seq, at: Date.now(), payload };
		seq += 1;
		events.push(event);

		// A cauda é o que cabe na tela do celular: um transcript de horas não precisa viver inteiro na
		// memória do servidor, e o começo dele ninguém rola para ler.
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

	return {
		list() {
			return events;
		},

		reset() {
			events = [];
			tools.clear();
			seq = 0;
		},

		apply(patches: TranscriptPatch[]) {
			return patches.flatMap((patch): AgentSessionEvent[] => {
				if (patch.type === "settle") {
					const updated = settle(patch);

					return updated ? [updated] : [];
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

				return [event];
			});
		},
	};
}
