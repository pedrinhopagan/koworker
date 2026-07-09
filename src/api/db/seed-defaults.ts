import { homedir } from "node:os";
import { join } from "node:path";

import { DEFAULT_CATEGORIES } from "@/constants/categories";
import { defaultSystemSettings, setSystemSettings } from "../helpers/system-settings";
import { dbAgentSourcePaths } from "./agent-source-paths";
import { dbCategories } from "./categories";
import { db } from "./connection";
import { normalizeEntityName } from "./entity-name";
import { dbSettings } from "./settings";
import { dbSkillSourcePaths } from "./skill-source-paths";

// O multiplexador de terminal `herdr` foi renomeado para `kw-terminal` (o binário externo mudou de
// nome). Bancos existentes ainda podem ter o valor antigo gravado em `terminal_multiplexer`. UPDATE
// único no boot; naturalmente idempotente — sem linha "herdr", roda como no-op.
export async function migrateTerminalMultiplexerRename() {
	await db
		.updateTable("settings")
		.set({ value: "kw-terminal", updated_at: Date.now() })
		.where("key", "=", "terminal_multiplexer")
		.where("value", "=", "herdr")
		.execute();
}

// Marca que os defaults de SO já foram semeados. Sem isso, semear a cada boot recriaria roots que o
// usuário removeu de propósito.
const SEEDED_MARKER = "default_sources_seeded";

// Marca própria das categorias default: separa o ciclo de vida delas do dos roots de SO, para que
// semear uma não force a outra.
const CATEGORIES_SEEDED_MARKER = "default_categories_seeded";

// Semeia, uma única vez, a configuração de SO por plataforma e os roots default de agents/skills que
// antes eram constantes no código. Roda no boot do backend, depois do schema estar garantido.
export async function ensureDefaultSettings() {
	if (await dbSettings.has(SEEDED_MARKER)) {
		return;
	}

	const home = homedir();

	await setSystemSettings(defaultSystemSettings());

	await dbAgentSourcePaths.seedGlobals([
		{ tool: "claude-code", path: join(home, ".claude/agents") },
		{ tool: "opencode", path: join(home, ".config/opencode/agent") },
		{ tool: "codex", path: join(home, ".codex/agents") },
	]);

	await dbSkillSourcePaths.seedGlobals([
		{ tool: "opencode", path: join(home, ".config/opencode/skills") },
		{ tool: "claude-code", path: join(home, ".claude/skills") },
		{ tool: "codex", path: join(home, ".codex/skills") },
		{ tool: "agents", path: join(home, ".agents/skills") },
	]);

	await dbSettings.set({ key: SEEDED_MARKER, value: "1" });
}

// Semeia, uma única vez, as categorias padrão já vinculadas à estrutura de prompt. Cria só as
// ausentes por nome normalizado — bancos que já têm "feature"/"fix" pré-existentes não ganham
// duplicata, e categorias criadas pelo usuário nunca são tocadas.
export async function ensureDefaultCategories() {
	if (await dbSettings.has(CATEGORIES_SEEDED_MARKER)) {
		return;
	}

	const existing = await dbCategories.getAll();
	const existingNames = new Set(existing.map((row) => normalizeEntityName(row.name)));

	for (const category of DEFAULT_CATEGORIES) {
		if (existingNames.has(normalizeEntityName(category.name))) {
			continue;
		}
		await dbCategories.create({
			id: crypto.randomUUID(),
			name: category.name,
			color: category.color,
			structure_slug: category.structureSlug,
		});
	}

	await dbSettings.set({ key: CATEGORIES_SEEDED_MARKER, value: "1" });
}
