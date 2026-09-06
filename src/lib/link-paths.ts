const PATH_EXTENSIONS =
	/\.(md|mdx|txt|json|jsonc|ya?ml|toml|ts|tsx|js|jsx|mjs|cjs|css|scss|html|py|rs|go|java|kt|swift|rb|php|sh|fish|zsh|sql|env|lock|xml|svg|png|jpe?g|gif|webp|pdf|csv|log|ini|conf)$/i;

const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|\[?::1\]?)$/;

// Citação de arquivo tem cara de caminho: `src/a.ts:12`, `./README.md`, `package.json`. Tudo o
// que tem espaço, parêntese ou não termina numa extensão conhecida fica como texto.
export function looksLikeFilePath(text: string) {
	const value = text.trim();
	if (!/^[\w.@~+/-][\w./@~+-]*(?::\d+(?::\d+)?)?$/.test(value) || /^\d/.test(value)) {
		return false;
	}

	const withoutPosition = value.replace(/:\d+(?::\d+)?$/, "");
	if (withoutPosition.endsWith(".") || withoutPosition.endsWith("/")) {
		return false;
	}

	return withoutPosition.includes("/") || PATH_EXTENSIONS.test(withoutPosition);
}

export function linkLine(target: string) {
	const match = /:(\d+)(?::\d+)?[),.;:!?]*$/.exec(target.trim());
	return match ? Number(match[1]) : null;
}

export function fileViewerHref(path: string, line?: number | null) {
	const params = new URLSearchParams({ path });
	if (line) {
		params.set("line", String(line));
	}

	return `/arquivo?${params.toString()}`;
}

// Cliente longe da máquina do backend (PWA no celular, browser via Tailscale) não vê um arquivo
// aberto "no computador": lá o arquivo abre dentro do próprio app.
export function opensFilesInApp(hostname: string, desktop: boolean) {
	return !desktop && !LOCAL_HOSTS.test(hostname);
}
