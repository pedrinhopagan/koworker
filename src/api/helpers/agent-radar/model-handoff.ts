import type { AgentSessionEvent } from "@/lib/agent-session";

export const HANDOFF_SUMMARY_MAX_CHARS = 16_000;

// Uma linha só: o texto vai para o prompt do TUI, e quebra de linha aqui viraria envio no meio.
export const HANDOFF_PROMPT =
	"Vou continuar esta conversa em outro agent, e este resumo será toda a memória que ele terá dela. " +
	"Escreva agora, em português e em markdown, um resumo de passagem completo e autossuficiente com estas seções: " +
	"1. Pedido e intenção do usuário; 2. Decisões tomadas e contexto técnico relevante; " +
	"3. Arquivos e trechos importantes (caminhos completos e o que foi feito em cada um); " +
	"4. Erros encontrados e como foram corrigidos; 5. Estado atual e pendências; 6. Próximo passo exato. " +
	"Só texto: não use ferramentas, não edite arquivos e não faça perguntas.";

// O resumo é tudo o que o agent disse depois do pedido: um agent que abre com "vou resumir" e
// fecha com o resumo entra inteiro, e o que veio antes do pedido fica de fora.
export function handoffSummary(events: AgentSessionEvent[], baseline: number): string | null {
	const text = events
		.filter((event) => event.seq > baseline && event.payload.kind === "assistant")
		.map((event) => (event.payload.kind === "assistant" ? event.payload.text.trim() : ""))
		.filter(Boolean)
		.join("\n\n");
	if (!text) {
		return null;
	}

	return text.length > HANDOFF_SUMMARY_MAX_CHARS
		? `${text.slice(0, HANDOFF_SUMMARY_MAX_CHARS)}\n\n[resumo cortado por tamanho]`
		: text;
}

export function handoffQuestion(events: AgentSessionEvent[], baseline: number) {
	return events.some(
		(event) => event.seq > baseline && event.payload.kind === "question" && !event.payload.answers,
	);
}

export function handoffOpeningPrompt(params: { from: string; summary: string; text: string }) {
	return [
		`Esta conversa continua uma sessão anterior conduzida no ${params.from}. O resumo abaixo foi escrito por aquele agent e é toda a memória que você tem dela: leia antes de agir e confirme no código o que precisar.`,
		"<resumo-da-sessao-anterior>",
		params.summary,
		"</resumo-da-sessao-anterior>",
		"Continue a partir daí. Nova mensagem do usuário:",
		params.text,
	].join("\n\n");
}
