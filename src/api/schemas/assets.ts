import { z } from "zod";

// Um único segmento de caminho, sem separadores nem referência a pai — é boundary, vira parte de um
// path no FS. Vale pra nome de arquivo de asset e pra subpasta do id curto no mostruário. A extensão
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

export const MostruarioListSchema = z.object({
	projectId: z.string().trim().min(1).optional(),
});

export const MostruarioReadFileSchema = z.object({
	projectId: z.string().trim().min(1),
	taskFolder: pathSegment,
	name: pathSegment,
});

export const MostruarioDeleteSchema = z.object({
	projectId: z.string().trim().min(1),
	taskFolder: pathSegment,
	name: pathSegment,
});

export const MostruarioRenameSchema = z.object({
	projectId: z.string().trim().min(1),
	taskFolder: pathSegment,
	oldName: pathSegment,
	newName: pathSegment,
});

// Move os artefatos de uma tarefa pro mostruário. names opcional: omitido move todos os artefatos
// detectados na pasta da tarefa; presente restringe aos nomes escolhidos (o par de mesmo basename
// vai junto de qualquer forma, resolvido no helper).
export const MostruarioMoveFromTaskSchema = z.object({
	taskId: z.string().trim().min(1),
	names: z.array(pathSegment).min(1).optional(),
});

// Lê um artefato (.html/.pdf) ainda dentro da pasta da tarefa, pra visualizar antes de mover.
export const TaskReadArtifactSchema = z.object({
	id: z.string().trim().min(1),
	name: pathSegment,
});
