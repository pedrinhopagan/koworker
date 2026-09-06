import type { CliModelOption } from "@/api/schemas/agent-radar";
import type { InvokeCli } from "@/constants/invoke";
import { modelDisplayLabel } from "@/lib/model-label";

// O que a próxima mensagem vai usar. `model`/`effort` nulos significam "o que a sessão já tem" (ou
// o padrão do CLI, quando a CLI muda).
export type ModelTarget = { cli: InvokeCli; model: string | null; effort: string | null };

export type ModelSession = { cli: InvokeCli | null; model: string | null; effort: string | null };

const CLAUDE_FAMILY = /^claude-([a-z]+)-/;

// O transcript grava o id completo ("claude-fable-5-1", "gpt-6-astra"); o catálogo fala em
// apelidos ("fable") ou slugs. Casar os dois é o que deixa o seletor marcar o modelo atual e não
// mandar `/model` para o modelo que já está em uso.
export function sessionModelId(options: CliModelOption[] | undefined, observed: string | null) {
	if (!observed) {
		return null;
	}
	if (!options || options.some((option) => option.id === observed)) {
		return observed;
	}

	const family = CLAUDE_FAMILY.exec(observed)?.[1];
	const alias = family ? options.find((option) => option.id === family) : undefined;

	return alias?.id ?? observed;
}

export function modelOptionLabel(options: CliModelOption[] | undefined, id: string | null) {
	if (!id) {
		return null;
	}

	return options?.find((option) => option.id === id)?.label ?? modelDisplayLabel(id);
}

export type ModelTargetDiff = { cli: boolean; model?: string; effort?: string };

// Só o que difere da sessão viaja: mandar `/model` para o modelo atual trocaria a variante em uso
// (a `[1m]`, por exemplo) sem ninguém ter pedido.
export function modelTargetDiff(
	choice: ModelTarget,
	session: ModelSession,
): ModelTargetDiff | null {
	const cli = choice.cli !== session.cli;
	const model = choice.model && (cli || choice.model !== session.model) ? choice.model : undefined;
	const effort =
		choice.effort && (cli || choice.effort !== session.effort) ? choice.effort : undefined;

	if (!cli && !model && !effort) {
		return null;
	}

	return { cli, ...(model ? { model } : {}), ...(effort ? { effort } : {}) };
}
