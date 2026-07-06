// Pastas irmãs dentro de `.koworker/` que não são pastas de tarefa nem `.md` soltos do vault:
// `medias/` guarda mídia solta do projeto; `mostruario/<id>/` guarda os artefatos "robustos"
// (HTML/PDF) de cada tarefa, chaveados pelo mesmo id curto da pasta da tarefa — é esse id
// compartilhado que liga tarefa ↔ mostruário na UI.
export const MEDIAS_DIRNAME = "medias";
export const MOSTRUARIO_DIRNAME = "mostruario";

// Nomes reservados no root do `.koworker/`: o vault os exclui da listagem de pastas soltas pra que
// nunca sejam adotados como tarefa.
export const RESERVED_KOWORKER_FOLDERS = new Set([MEDIAS_DIRNAME, MOSTRUARIO_DIRNAME]);

// Tipos de arquivo que o viewer renderiza inline. A correspondência extensão → MIME é dado, não
// controle de fluxo. O MIME viaja no Blob até o front, que escolhe iframe (HTML sandbox) ou o
// viewer nativo de PDF pela própria extensão/tipo.
export const ASSET_MIME_BY_EXT: Record<string, string> = {
	".html": "text/html",
	".htm": "text/html",
	".pdf": "application/pdf",
};
