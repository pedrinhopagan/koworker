import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { DEFAULT_CATEGORIES } from "@/constants/categories";
import { expandTilde } from "../helpers/os-actions";
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

// Marca que a config de SO já foi semeada uma vez. Sem isso, reescrever os settings a cada boot
// sobrescreveria ajustes do usuário.
const SEEDED_MARKER = "default_sources_seeded";

// Marca própria das categorias default: separa o ciclo de vida delas do dos roots de SO, para que
// semear uma não force a outra.
const CATEGORIES_SEEDED_MARKER = "default_categories_seeded";

// Garante que cada root default de plataforma exista com scope 'global', sem duplicar. Compara com o
// til expandido para reconhecer linhas custom equivalentes (ex.: `~/.claude/skills`) e nunca remove
// linhas do usuário. Insere só os que faltam, todo boot — o koworker fica sempre pronto para buscar
// skills/agents de todos os lugares comuns, mesmo que um default novo entre no código depois.
async function ensureGlobalRoots<T extends string>(
	dao: {
		list: () => Promise<{ tool: string; path: string }[]>;
		seedGlobals: (roots: { tool: T; path: string }[]) => Promise<unknown>;
	},
	defaults: { tool: T; path: string }[],
) {
	const existing = await dao.list();
	const known = new Set(existing.map((row) => resolve(expandTilde(row.path))));
	const missing = defaults.filter((root) => !known.has(resolve(root.path)));
	if (missing.length === 0) {
		return;
	}

	await dao.seedGlobals(missing);
}

// Semeia a configuração de SO por plataforma (uma única vez) e garante os roots default de
// agents/skills a cada boot. Roda depois do schema estar garantido.
export async function ensureDefaultSettings() {
	const home = homedir();

	if (!(await dbSettings.has(SEEDED_MARKER))) {
		await setSystemSettings(defaultSystemSettings());
		await dbSettings.set({ key: SEEDED_MARKER, value: "1" });
	}

	await ensureGlobalRoots(dbAgentSourcePaths, [
		{ tool: "claude-code", path: join(home, ".claude/agents") },
		{ tool: "opencode", path: join(home, ".config/opencode/agent") },
		{ tool: "codex", path: join(home, ".codex/agents") },
	]);

	await ensureGlobalRoots(dbSkillSourcePaths, [
		{ tool: "opencode", path: join(home, ".config/opencode/skills") },
		{ tool: "claude-code", path: join(home, ".claude/skills") },
		{ tool: "codex", path: join(home, ".codex/skills") },
		{ tool: "agents", path: join(home, ".agents/skills") },
	]);
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
