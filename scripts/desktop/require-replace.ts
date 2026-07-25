export function requireReplace(
	source: string,
	pattern: string | RegExp,
	replacement: string,
	description: string,
): string {
	const matched = typeof pattern === "string" ? source.includes(pattern) : pattern.test(source);

	if (!matched) {
		throw new Error(
			`Falha ao ${description}: padrão ${String(pattern)} não encontrado no arquivo de origem.`,
		);
	}

	return source.replace(pattern, replacement);
}
