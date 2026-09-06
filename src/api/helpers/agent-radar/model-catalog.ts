import { homedir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

import type { CliModelOption, ModelCatalog } from "@/api/schemas/agent-radar";
import { CODEX_MODEL_OPTIONS, INVOKE_INHERIT } from "@/constants/invoke";

const CLAUDE_EFFORTS = ["low", "medium", "high", "xhigh", "max"];

// Os apelidos que `claude --model` e `/model` aceitam. O binário não publica catálogo; a lista é a
// família atual, na ordem do seletor do próprio CLI.
export const CLAUDE_MODELS: CliModelOption[] = [
	{
		id: "fable",
		label: "Fable 5.1",
		hint: "Mais capaz para tarefas difíceis e longas",
		efforts: CLAUDE_EFFORTS,
		defaultEffort: null,
	},
	{
		id: "opus",
		label: "Opus 5",
		hint: "O melhor para o dia a dia complexo",
		efforts: CLAUDE_EFFORTS,
		defaultEffort: null,
	},
	{
		id: "sonnet",
		label: "Sonnet 5",
		hint: "Rápido, bom para sessões longas",
		efforts: CLAUDE_EFFORTS,
		defaultEffort: null,
	},
	{
		id: "haiku",
		label: "Haiku 4.5",
		hint: "O mais rápido e barato",
		efforts: CLAUDE_EFFORTS,
		defaultEffort: null,
	},
];

const CODEX_MODELS_CACHE = join(homedir(), ".codex", "models_cache.json");

const CodexModelsCacheSchema = z.object({
	models: z.array(
		z
			.object({
				slug: z.string().min(1),
				display_name: z.string().optional(),
				description: z.string().optional(),
				visibility: z.string().optional(),
				priority: z.number().optional(),
				default_reasoning_level: z.string().optional(),
				supported_reasoning_levels: z
					.array(z.object({ effort: z.string() }).passthrough())
					.optional(),
			})
			.passthrough(),
	),
});

const CODEX_FALLBACK: CliModelOption[] = CODEX_MODEL_OPTIONS.filter(
	(option) => option.value !== INVOKE_INHERIT,
).map((option) => ({
	id: option.value,
	label: option.label,
	hint: "",
	efforts: ["low", "medium", "high", "xhigh"],
	defaultEffort: null,
}));

// O codex guarda em `~/.codex/models_cache.json` o catálogo que o próprio `/model` mostra: nome,
// descrição, níveis de esforço por modelo e a ordem (`priority`, menor primeiro). Ler dali é o que
// deixa o seletor acompanhar modelo novo sem redeploy; `hide` são modelos internos do CLI.
export function codexModelsFromCache(raw: unknown): CliModelOption[] | null {
	const parsed = CodexModelsCacheSchema.safeParse(raw);
	if (!parsed.success) {
		return null;
	}

	const models = parsed.data.models
		.filter((model) => (model.visibility ?? "list") === "list")
		.sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0))
		.map((model) => ({
			id: model.slug,
			label: (model.display_name ?? model.slug).replaceAll("-", " "),
			hint: model.description ?? "",
			efforts: (model.supported_reasoning_levels ?? []).map((level) => level.effort),
			defaultEffort: model.default_reasoning_level ?? null,
		}));

	return models.length > 0 ? models : null;
}

export async function loadModelCatalog(): Promise<ModelCatalog> {
	const codex = await Bun.file(CODEX_MODELS_CACHE)
		.json()
		.then(codexModelsFromCache)
		.catch(() => null);

	return { claude: CLAUDE_MODELS, codex: codex ?? CODEX_FALLBACK };
}
