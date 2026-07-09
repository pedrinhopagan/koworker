import { z } from "zod";

import { IMAGE_MIME_BY_EXT } from "@/constants/koworker";

// Um único segmento de caminho, sem separadores nem referência a pai — é boundary, vira parte de um
// path no FS. Vale pra nome de arquivo de asset (mídia ou artefato da tarefa). A extensão
// renderizável é conferida no helper (readAssetFile devolve null pra tipo desconhecido).
const pathSegment = z
	.string()
	.trim()
	.min(1)
	.regex(/^[^/\\]+$/, "Não pode conter separadores de caminho")
	.refine((value) => value !== "." && value !== "..", "Nome inválido");

// projectId opcional: presente compõe um projeto; ausente ("Todos os projetos") agrega todos.
export const MediaListSchema = z.object({
	projectId: z.string().trim().min(1).optional(),
});

// Upload de imagem colada no prompt bar: só os MIMEs da whitelist de `medias/` — o nome do arquivo
// nasce no backend, então o MIME é a única identidade que o clipboard entrega.
export const MediaUploadSchema = z.object({
	projectId: z.string().trim().min(1),
	file: z.file().mime([...new Set(Object.values(IMAGE_MIME_BY_EXT))]),
});

export const MediaReadFileSchema = z.object({
	projectId: z.string().trim().min(1),
	name: pathSegment,
});

export const MediaDeleteSchema = z.object({
	projectId: z.string().trim().min(1),
	name: pathSegment,
});

export const MediaRenameSchema = z.object({
	projectId: z.string().trim().min(1),
	oldName: pathSegment,
	newName: pathSegment,
});

// Tarefas com artefatos (.html/.pdf) na própria pasta. projectId opcional: presente filtra um
// projeto; ausente ("Todos os projetos") agrega todos.
export const MostruarioListSchema = z.object({
	projectId: z.string().trim().min(1).optional(),
});

// Abre um artefato (.html/.pdf) da pasta da tarefa no app padrão do SO. O path absoluto nasce e morre
// no backend, dono de main_route/folder_path.
export const TaskOpenArtifactSchema = z.object({
	id: z.string().trim().min(1),
	name: pathSegment,
});
