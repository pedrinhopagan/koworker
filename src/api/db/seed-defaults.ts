import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { DEFAULT_AGENT_CATEGORIES } from "@/constants/agent-categories";
import { expandTilde } from "../helpers/os-actions";
import {
	defaultSystemSettings,
	LEGACY_TERMINAL_SETTING_KEYS,
	setSystemSettings,
} from "../helpers/system-settings";
import { dbAgentCategories } from "./agent-categories";
import { dbAgentSettings } from "./agent-settings";
import { dbAgentSourcePaths } from "./agent-source-paths";
import { db } from "./connection";
import { dbSettings } from "./settings";
import { dbSkillSourcePaths } from "./skill-source-paths";

// O terminal externo virou só kw-terminal: quem tinha tmux, none ou um template de emulador passa a
// abrir no kw-terminal, e as preferências antigas saem do banco. Só onde o kw-terminal roda; no
// Windows não há para onde migrar. Idempotente: sem as linhas, é no-op.
export async function migrateLegacyTerminalSettings() {
	if (process.platform === "win32") return;

	await db.deleteFrom("settings").where("key", "in", LEGACY_TERMINAL_SETTING_KEYS).execute();
}

// Marca que a config de SO já foi semeada uma vez. Sem isso, reescrever os settings a cada boot
// sobrescreveria ajustes do usuário.
const SEEDED_MARKER = "default_sources_seeded";

// Marca própria das categorias default: separa o ciclo de vida delas do dos roots de SO, para que
// semear uma não force a outra.

const AGENT_CATEGORIES_SEEDED_MARKER = "default_agent_categories_seeded";

// Garante que cada root default de plataforma exista com scope 'global', sem duplicar. Compara com o
// til expandido para reconhecer linhas custom equivalentes (ex.: `~/.claude/skills`) e nunca remove
// linhas do usuário. Insere só os que faltam e existem no disco, todo boot: um default novo entra
// sozinho quando a pasta aparece, e uma raiz que a máquina não tem nunca vira linha morta na tela.
async function ensureGlobalRoots<T extends string>(
	dao: {
		list: () => Promise<{ tool: string; path: string }[]>;
		seedGlobals: (roots: { tool: T; path: string }[]) => Promise<unknown>;
	},
	defaults: { tool: T; path: string }[],
) {
	const existing = await dao.list();
	const known = new Set(existing.map((row) => resolve(expandTilde(row.path))));
	const missing = defaults.filter(
		(root) => !known.has(resolve(root.path)) && existsSync(root.path),
	);
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

// Semeia, uma única vez, as categorias de agents e o ícone/cor/categoria de cada perfil conhecido.
// Categoria existente por nome normalizado é reaproveitada; override que o usuário já gravou em
// agent_settings (ícone, cor ou categoria) nunca é sobrescrito.
export async function ensureDefaultAgentCategories() {
	if (await dbSettings.has(AGENT_CATEGORIES_SEEDED_MARKER)) {
		return;
	}

	const settingsBySlug = new Map((await dbAgentSettings.getAll()).map((row) => [row.slug, row]));

	for (const category of DEFAULT_AGENT_CATEGORIES) {
		const existing = await dbAgentCategories.findByNormalizedName(category.name);
		const categoryId = existing?.id ?? crypto.randomUUID();
		if (!existing) {
			await dbAgentCategories.create({
				id: categoryId,
				name: category.name,
				color: category.color,
			});
		}

		for (const agent of category.agents) {
			const current = settingsBySlug.get(agent.slug);
			await dbAgentSettings.upsert({
				slug: agent.slug,
				icon: current?.icon ?? agent.icon,
				color: current?.color ?? category.color,
				categoryId: current?.category_id ?? categoryId,
			});
		}
	}

	await dbSettings.set({ key: AGENT_CATEGORIES_SEEDED_MARKER, value: "1" });
}
