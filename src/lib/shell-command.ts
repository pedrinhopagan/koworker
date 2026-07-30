// Um comando de terminal no rastro do agente não cabe em uma linha: vem com `cd`, variável de
// ambiente, pipe e heredoc. O que identifica o passo é o programa — ver `agent-browser` já diz o que
// aquele terminal está fazendo, e o comando inteiro fica para quem abrir.
const PREFIXES = new Set(["sudo", "env", "nohup", "command", "exec", "time", "xargs"]);
const SETUP = new Set(["cd", "export", "set", "source", ".", "pushd", "unset"]);
const RUNNERS = new Set(["bun", "bunx", "npx", "npm", "pnpm", "yarn", "uv", "uvx", "deno", "node"]);
// Programas cujo verbo é a informação: `agent-browser open` diz o que o terminal faz, `agent-browser`
// sozinho não.
const SUBCOMMANDS = new Set([
	"git",
	"gh",
	"docker",
	"cargo",
	"go",
	"kw-cli",
	"systemctl",
	"tmux",
	"agent-browser",
	"kubectl",
	"pm2",
]);
const CHAIN = /&&|\|\||;|\|/;

function program(segment: string) {
	const tokens = segment.trim().split(/\s+/).filter(Boolean);
	const start = tokens.findIndex((token) => !token.includes("=") && !PREFIXES.has(token));

	if (start === -1) {
		return null;
	}

	const name = tokens[start]?.split("/").at(-1);
	if (!name) {
		return null;
	}

	const rest = tokens.slice(start + 1).filter((token) => !token.startsWith("-"));
	const first = rest[0];

	if (RUNNERS.has(name) && first) {
		const second = first === "run" || first === "x" || first === "exec" ? rest[1] : null;

		return { name, sub: [first, second].filter(Boolean).join(" "), setup: SETUP.has(name) };
	}

	if (SUBCOMMANDS.has(name) && first) {
		return { name, sub: first, setup: SETUP.has(name) };
	}

	return { name, sub: "", setup: SETUP.has(name) };
}

// O rótulo do comando: o primeiro programa que não é só preparação de ambiente. `cd repo && bun test`
// é um `bun test`, não um `cd`.
export function commandLabel(command: string) {
	const line = command.split("\n")[0] ?? "";
	const found = line
		.split(CHAIN)
		.map(program)
		.filter((entry): entry is NonNullable<typeof entry> => !!entry);

	const chosen = found.find((entry) => !entry.setup) ?? found[0];
	if (!chosen) {
		return null;
	}

	return [chosen.name, chosen.sub].filter(Boolean).join(" ");
}
