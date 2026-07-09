// Pasta irmã dentro de `.koworker/` que não é pasta de tarefa nem `.md` solto do vault:
// `medias/` guarda mídia solta do projeto.
export const MEDIAS_DIRNAME = "medias";

// Nomes reservados no root do `.koworker/`: o vault os exclui da listagem de pastas soltas pra que
// nunca sejam adotados como tarefa.
export const RESERVED_KOWORKER_FOLDERS = new Set([MEDIAS_DIRNAME]);

// Correspondência extensão → MIME dos assets. `IMAGE_MIME_BY_EXT` é a whitelist de `medias/`, que só
// aceita imagens e as renderiza inline em /media. `DOC_MIME_BY_EXT` é a whitelist de
// `listTaskArtifacts`: os artefatos robustos (HTML/PDF) vivem na pasta da própria tarefa e são
// abertos no app padrão do SO, não renderizados inline. O MIME é dado, não controle de fluxo.
export const IMAGE_MIME_BY_EXT: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".avif": "image/avif",
	".svg": "image/svg+xml",
	".bmp": "image/bmp",
};

export const DOC_MIME_BY_EXT: Record<string, string> = {
	".html": "text/html",
	".htm": "text/html",
	".pdf": "application/pdf",
};

// Inverso de IMAGE_MIME_BY_EXT pra nomear um upload a partir do MIME que o navegador entrega
// (clipboard não tem nome de arquivo). Extensões sinônimas (.jpg/.jpeg) ficam com a primeira.
export const EXT_BY_IMAGE_MIME: Record<string, string> = {};
for (const [ext, mime] of Object.entries(IMAGE_MIME_BY_EXT)) {
	EXT_BY_IMAGE_MIME[mime] ??= ext;
}

// Caminho de uma mídia relativo à raiz do projeto — a grafia que viaja em prompts (o CLI roda com
// cwd na raiz) e que o front usa pra abrir o arquivo no SO.
export function mediaRelativePath(name: string): string {
	return `.koworker/${MEDIAS_DIRNAME}/${name}`;
}
