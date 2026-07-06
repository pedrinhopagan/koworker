// Pastas irmãs dentro de `.koworker/` que não são pastas de tarefa nem `.md` soltos do vault:
// `medias/` guarda mídia solta do projeto; `mostruario/<id>/` guarda os artefatos "robustos"
// (HTML/PDF) de cada tarefa, chaveados pelo mesmo id curto da pasta da tarefa — é esse id
// compartilhado que liga tarefa ↔ mostruário na UI.
export const MEDIAS_DIRNAME = "medias";
export const MOSTRUARIO_DIRNAME = "mostruario";

// Nomes reservados no root do `.koworker/`: o vault os exclui da listagem de pastas soltas pra que
// nunca sejam adotados como tarefa.
export const RESERVED_KOWORKER_FOLDERS = new Set([MEDIAS_DIRNAME, MOSTRUARIO_DIRNAME]);

// Tipos de arquivo que o viewer renderiza inline, separados por destino: `medias/` só aceita
// imagens; `mostruario/` (e os artefatos ainda na pasta da tarefa) só aceitam documentos robustos
// (HTML/PDF). A correspondência extensão → MIME é dado, não controle de fluxo — o MIME viaja no Blob
// até o front, que escolhe <img>, iframe sandbox (HTML) ou o viewer nativo de PDF pelo próprio tipo.
// É essa divisão que faz um PDF nunca aparecer em /media e uma imagem nunca aparecer no mostruário.
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
