// Parser mínimo de `--chave valor` e `--chave=valor`. Tudo que não começa com `--` vira
// posicional, na ordem. Uma flag sem valor (seguida de outra flag ou no fim) fica como "".
// Sem dependência externa — a CLI tem só um punhado de flags simples.
export function parseArgs(argv: string[]): {
	positionals: string[];
	flags: Record<string, string>;
} {
	const positionals: string[] = [];
	const flags: Record<string, string> = {};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];

		if (!arg.startsWith("--")) {
			positionals.push(arg);
			continue;
		}

		const eq = arg.indexOf("=");
		if (eq !== -1) {
			flags[arg.slice(2, eq)] = arg.slice(eq + 1);
			continue;
		}

		const key = arg.slice(2);
		const next = argv[i + 1];
		if (next === undefined || next.startsWith("--")) {
			flags[key] = "";
		} else {
			flags[key] = next;
			i++;
		}
	}

	return { positionals, flags };
}

export function hasFlag(flags: Record<string, string>, key: string): boolean {
	return Object.hasOwn(flags, key);
}
