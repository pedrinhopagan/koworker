// Cache-Control por classe de asset servida pelo backend. Sem isso o navegador usa cache
// heurístico e o celular abre com HTML/JS velho depois de um deploy. Regra:
// - arquivos sem hash no nome (index.html, main.js, index.css, sw.js) → `no-cache`: revalida
//   sempre; barato, porque o 304 vem de graça e o service worker cobre o offline.
// - chunks com hash no nome → imutáveis por um ano: conteúdo novo é nome novo.
// - /static/* estável (fontes, ícones) → uma semana; manifest revalida porque aponta ícones.

// Chunks do bundler carregam sufixo de conteúdo em base36 (`nome-pw2yg2ah.js`). Exigir exatamente
// o formato evita dar cache imutável a asset solto que só tem hífen no nome.
const HASHED_CHUNK_PATTERN = /-[0-9a-z]{8}\.js$/;

export function isHashedChunk(pathname: string): boolean {
	const basename = pathname.split("/").pop() ?? "";

	return HASHED_CHUNK_PATTERN.test(basename);
}

export function staticCacheHeader(pathname: string): string | null {
	if (pathname === "/" || pathname === "/index.html" || pathname.endsWith(".html")) {
		return "no-cache";
	}

	if (pathname === "/sw.js") {
		return "no-cache";
	}

	if (pathname === "/main.js" || pathname === "/index.css") {
		return "no-cache";
	}

	if (pathname.startsWith("/static/")) {
		if (pathname.endsWith(".webmanifest")) {
			return "no-cache";
		}

		return "public, max-age=604800";
	}

	if (pathname === "/version.json" || pathname === "/revision.json") {
		return "no-cache";
	}

	if (isHashedChunk(pathname)) {
		return "public, max-age=31536000, immutable";
	}

	return "no-cache";
}
