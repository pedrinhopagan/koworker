const CODEX_SUFFIXES: Record<string, string> = {
	sol: "Sol",
	terra: "Terra",
	luna: "Lua",
	codex: "Codex",
};

const CLAUDE_ID = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/;
const GPT_ID = /^gpt-(\d+(?:\.\d+)?)(?:-([a-z]+))?$/;

// O id que o CLI grava no transcript ("claude-opus-5", "gpt-5.6-sol") vira o nome que o app já usa
// nos selects ("Opus 5", "GPT-5.6 Sol"). Id desconhecido aparece cru: errado é esconder o modelo.
export function modelDisplayLabel(id: string) {
	const claude = CLAUDE_ID.exec(id);
	if (claude?.[1] && claude[2]) {
		const family = claude[1][0]?.toUpperCase() + claude[1].slice(1);
		const version = claude[3] ? `${claude[2]}.${claude[3]}` : claude[2];

		return `${family} ${version}`;
	}

	const gpt = GPT_ID.exec(id);
	if (gpt?.[1]) {
		const suffix = gpt[2] ? ` ${CODEX_SUFFIXES[gpt[2]] ?? gpt[2]}` : "";

		return `GPT-${gpt[1]}${suffix}`;
	}

	return id;
}
