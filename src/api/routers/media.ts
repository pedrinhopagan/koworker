import { protectedProcedure } from "../auth/context";
import { dbProjects } from "../db/projects";
import {
	type AssetFileMeta,
	deleteMediaFile,
	listMediaFiles,
	readMediaFile,
	renameMediaFile,
} from "../helpers/koworker-assets";
import {
	MediaDeleteSchema,
	MediaListSchema,
	MediaReadFileSchema,
	MediaRenameSchema,
} from "../schemas";

// Mídia solta de `.koworker/medias/`, marcada com o projeto de origem. Em "Todos os projetos" o
// projectId de cada entry é o discriminador que a UI usa pra abrir o arquivo no projeto certo.
type MediaEntry = AssetFileMeta & {
	projectId: string;
	projectName: string;
};

async function readProjectMedia(project: {
	id: string;
	name: string;
	main_route: string;
}): Promise<MediaEntry[]> {
	const files = await listMediaFiles(project.main_route);
	// Muta em vez de espalhar: cada meta é criada fresca em listMediaFiles, então anexar a origem
	// no lugar é seguro (e o que o oxlint no-map-spread pede).
	return files.map((file) =>
		Object.assign(file, { projectId: project.id, projectName: project.name }),
	);
}

export const mediaRouter = {
	// Com projectId, lista a mídia de um projeto; sem ele ("Todos"), agrega todos marcando a origem.
	list: protectedProcedure.input(MediaListSchema).handler(async ({ input }) => {
		if (input.projectId) {
			const project = await dbProjects.getById(input.projectId);
			if (!project) return { entries: [] as MediaEntry[] };

			return { entries: await readProjectMedia(project) };
		}

		const projects = await dbProjects.getAll();
		const parts = await Promise.all(projects.map(readProjectMedia));

		return { entries: parts.flat() };
	}),

	// Bytes de um arquivo (Blob no front). O projectId vem explícito da entry clicada, não do foco
	// global — abrir um arquivo não pode depender de qual projeto está focado no momento.
	readFile: protectedProcedure.input(MediaReadFileSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		const file = await readMediaFile({ projectRoute: project.main_route, name: input.name });
		if (!file) throw new Error("Arquivo não encontrado");

		return file;
	}),

	deleteFile: protectedProcedure.input(MediaDeleteSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		await deleteMediaFile({ projectRoute: project.main_route, name: input.name });

		return { name: input.name };
	}),

	renameFile: protectedProcedure.input(MediaRenameSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		await renameMediaFile({
			projectRoute: project.main_route,
			oldName: input.oldName,
			newName: input.newName,
		});

		return { oldName: input.oldName, newName: input.newName };
	}),
};
