import { homedir } from "node:os";
import { join } from "node:path";

import { defaultSystemSettings, setSystemSettings } from "../helpers/system-settings";
import { dbAgentSourcePaths } from "./agent-source-paths";
import { dbSettings } from "./settings";
import { dbSkillSourcePaths } from "./skill-source-paths";

// Marca que os defaults de SO já foram semeados. Sem isso, semear a cada boot recriaria roots que o
// usuário removeu de propósito.
const SEEDED_MARKER = "default_sources_seeded";

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
