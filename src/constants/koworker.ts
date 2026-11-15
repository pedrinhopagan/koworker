// Pasta irmã dentro de `.koworker/` que não é pasta de tarefa nem `.md` solto do vault:
// `medias/` guarda mídia solta do projeto.
export const MEDIAS_DIRNAME = "medias";

// Nomes reservados no root do `.koworker/`: o vault os exclui da listagem de pastas soltas pra que
// nunca sejam adotados como tarefa.
export const RESERVED_KOWORKER_FOLDERS = new Set([MEDIAS_DIRNAME, "tasks", ".backups", ".staging"]);

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

export const VIDEO_MIME_BY_EXT: Record<string, string> = {
	".mp4": "video/mp4",
	".webm": "video/webm",
	".mov": "video/quicktime",
	".m4v": "video/mp4",
	".ogv": "video/ogg",
};

export const AUDIO_MIME_BY_EXT: Record<string, string> = {
	".mp3": "audio/mpeg",
	".wav": "audio/wav",
	".ogg": "audio/ogg",
	".m4a": "audio/mp4",
	".flac": "audio/flac",
	".aac": "audio/aac",
};

export const ARTIFACT_MIME_BY_EXT: Record<string, string> = {
	...DOC_MIME_BY_EXT,
	...VIDEO_MIME_BY_EXT,
	...AUDIO_MIME_BY_EXT,
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
