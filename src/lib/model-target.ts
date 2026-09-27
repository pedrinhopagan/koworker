import type { CliModelOption } from "@/api/schemas/agent-radar";
import type { InvokeCli } from "@/constants/invoke";
import { modelDisplayLabel } from "@/lib/model-label";

// O que a próxima mensagem vai usar. `model`/`effort` nulos significam "o que a sessão já tem" (ou
// o padrão do CLI, quando a CLI muda).
export type ModelTarget = { cli: InvokeCli; model: string | null; effort: string | null };

export type ModelSession = { cli: InvokeCli | null; model: string | null; effort: string | null };

export function normalizeModelName(text: string) {
	return text.toLowerCase().replaceAll(/[^a-z0-9.]/g, "");
}

// O modelo chega de três jeitos: o id completo que o transcript grava ("claude-sonnet-5",
// "gpt-6-sol"), o nome que o terminal mostra ("Sonnet 5", "GPT-6-Sol") e o apelido antigo
// ("sonnet"). Casar os três com o catálogo é o que deixa o seletor marcar o modelo atual e não
// mandar `/model` para o modelo que já está em uso.
export function sessionModelId(options: CliModelOption[] | undefined, observed: string | null) {
	if (!observed || !options) {
		return observed;
	}

	const name = normalizeModelName(observed);
	const match =
		options.find((option) => option.id === observed) ??
		options.find((option) => normalizeModelName(option.label) === name) ??
		options.find((option) => option.id.startsWith(`claude-${observed}-`));

	return match?.id ?? observed;
}

export function modelOptionLabel(options: CliModelOption[] | undefined, id: string | null) {
	if (!id) {
		return null;
	}

	return options?.find((option) => option.id === id)?.label ?? modelDisplayLabel(id);
}

export type ModelTargetDiff = { cli: boolean; model?: string; effort?: string };

// Só o que difere da sessão viaja: mandar `/model` para o modelo atual trocaria a variante em uso
// (a `[1m]`, por exemplo) sem ninguém ter pedido. Trocar de modelo leva o esforço junto, porque o
// menu do CLI abre cada modelo no esforço salvo dele, não no que a tela mostrava.
export function modelTargetDiff(
	choice: ModelTarget,
	session: ModelSession,
): ModelTargetDiff | null {
	const cli = choice.cli !== session.cli;
	const model = choice.model && (cli || choice.model !== session.model) ? choice.model : undefined;
	const effort =
		choice.effort && (cli || !!model || choice.effort !== session.effort)
			? choice.effort
			: undefined;

	if (!cli && !model && !effort) {
		return null;
	}

	return { cli, ...(model ? { model } : {}), ...(effort ? { effort } : {}) };
}
