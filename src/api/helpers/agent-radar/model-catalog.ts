import { type FSWatcher, watch } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

import type { CliModelOption, ModelCatalog } from "@/api/schemas/agent-radar";
import { PubSub } from "@/api/pubsub";

const CLAUDE_CATALOG_DIR = join(homedir(), ".claude", "cache", "model-catalog");
const CODEX_DIR = join(homedir(), ".codex");
const CODEX_MODELS_CACHE = "models_cache.json";
const WATCH_DEBOUNCE_MS = 300;

function fallbackOption(id: string, label: string, efforts: string[]): CliModelOption {
	return { id, label, hint: "", efforts, defaultEffort: null, legacy: false };
}

// Só vale enquanto o Claude Code ainda não baixou o catálogo dele: é o recorte principal do
// `/model` da versão instalada, com os ids que `--model` aceita.
const CLAUDE_EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const CLAUDE_FALLBACK = [
	fallbackOption("claude-opus-5-5", "Opus 5.5", CLAUDE_EFFORTS),
	fallbackOption("claude-fable-5-1", "Fable 5.1", CLAUDE_EFFORTS),
	fallbackOption("claude-sonnet-5", "Sonnet 5", CLAUDE_EFFORTS),
	fallbackOption("claude-haiku-4-5-20251001", "Haiku 4.5", []),
];

const CODEX_EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const CODEX_FALLBACK = [
	fallbackOption("gpt-6-astra", "GPT-6-Astra", CODEX_EFFORTS),
	fallbackOption("gpt-6-sol", "GPT-6-Sol", CODEX_EFFORTS),
	fallbackOption("gpt-6-luna", "GPT-6-Luna", CODEX_EFFORTS),
];

// O Claude Code guarda em `~/.claude/cache/model-catalog/<conta>-cc.json` o catálogo que o próprio
// `/model` desenha: nome, descrição, seção (`main` em cima, `overflow` nas versões anteriores) e os
// níveis de esforço de cada modelo, com o padrão marcado pelo selo "Default".
const ClaudeCatalogSchema = z.object({
	catalog: z.object({
		config: z.object({
			models: z.array(
				z.object({
					id: z.string().min(1),
					name: z.string().min(1),
					description: z.string().optional(),
					section: z.string().optional(),
					thinking: z
						.object({
							effort_options: z
								.array(
									z.object({
										id: z.string(),
										badge: z.object({ message: z.string() }).optional(),
									}),
								)
								.optional(),
						})
						.optional(),
				}),
			),
		}),
	}),
});

export function claudeModelsFromCache(raw: unknown): CliModelOption[] | null {
	const parsed = ClaudeCatalogSchema.safeParse(raw);
	if (!parsed.success) {
		return null;
	}

	const models = parsed.data.catalog.config.models.map((model) => {
		const efforts = model.thinking?.effort_options ?? [];

		return {
			id: model.id,
			label: model.name,
			hint: model.description ?? "",
			efforts: efforts.map((effort) => effort.id),
			defaultEffort: efforts.find((effort) => effort.badge?.message === "Default")?.id ?? null,
			legacy: model.section === "overflow",
		};
	});

	return models.length > 0 ? models : null;
}

const CodexModelsCacheSchema = z.object({
	models: z.array(
		z.object({
			slug: z.string().min(1),
			display_name: z.string().optional(),
			description: z.string().optional(),
			visibility: z.string().optional(),
			priority: z.number().optional(),
			default_reasoning_level: z.string().optional(),
			supported_reasoning_levels: z.array(z.object({ effort: z.string() })).optional(),
		}),
	),
});

// O codex guarda em `~/.codex/models_cache.json` o catálogo que o próprio `/model` mostra: nome,
// descrição, níveis de esforço por modelo e a ordem (`priority`, menor primeiro). `hide` são
// modelos internos do CLI.
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
			label: model.display_name ?? model.slug,
			hint: model.description ?? "",
			efforts: (model.supported_reasoning_levels ?? []).map((level) => level.effort),
			defaultEffort: model.default_reasoning_level ?? null,
			legacy: false,
		}));

	return models.length > 0 ? models : null;
}

async function newestClaudeCatalog() {
	const names = await readdir(CLAUDE_CATALOG_DIR).catch(() => []);
	const files = await Promise.all(
		names
			.filter((name) => name.endsWith("-cc.json"))
			.map(async (name) => {
				const path = join(CLAUDE_CATALOG_DIR, name);
				return { path, mtime: (await stat(path)).mtimeMs };
			}),
	);

	return files.sort((left, right) => right.mtime - left.mtime)[0]?.path ?? null;
}

async function readJson(path: string | null) {
	return path
		? await Bun.file(path)
				.json()
				.catch(() => null)
		: null;
}

export async function loadModelCatalog(): Promise<ModelCatalog> {
	const [claude, codex] = await Promise.all([
		readJson(await newestClaudeCatalog()),
		readJson(join(CODEX_DIR, CODEX_MODELS_CACHE)),
	]);

	return {
		claude: claudeModelsFromCache(claude) ?? CLAUDE_FALLBACK,
		codex: codexModelsFromCache(codex) ?? CODEX_FALLBACK,
	};
}

let watchers: FSWatcher[] | null = null;

// Os dois CLIs regravam o cache quando o catálogo do servidor muda; o app republica o catálogo no
// mesmo instante, sem ninguém recarregar. Um watcher por processo, aberto na primeira assinatura.
export function watchModelCatalog() {
	if (watchers) {
		return;
	}

	let timer: ReturnType<typeof setTimeout> | null = null;
	let last = "";
	function schedule() {
		if (timer) {
			return;
		}
		timer = setTimeout(() => {
			timer = null;
			void loadModelCatalog().then((catalog) => {
				const serialized = JSON.stringify(catalog);
				if (serialized !== last) {
					last = serialized;
					void PubSub.publish("modelCatalog", "global", catalog);
				}
			});
		}, WATCH_DEBOUNCE_MS);
		timer.unref();
	}

	void loadModelCatalog().then((catalog) => {
		last = JSON.stringify(catalog);
	});
	watchers = [
		{ dir: CLAUDE_CATALOG_DIR, match: (name: string) => name.endsWith("-cc.json") },
		{ dir: CODEX_DIR, match: (name: string) => name === CODEX_MODELS_CACHE },
	].flatMap(({ dir, match }) => {
		try {
			const watcher = watch(dir, { persistent: false }, (_event, name) => {
				if (name && match(name.toString())) {
					schedule();
				}
			});
			watcher.on("error", () => {});
			return [watcher];
		} catch {
			return [];
		}
	});
}
