import { protectedProcedure } from "../auth/context";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { listTaskArtifacts, type TaskArtifactMeta } from "../helpers/koworker-assets";
import { MostruarioListSchema } from "../schemas";
import { mapTasks } from "./tasks";

function latestArtifact(artifacts: TaskArtifactMeta[]): number {
	return artifacts.reduce((max, artifact) => Math.max(max, artifact.mtime), 0);
}

// Tarefas de um projeto que têm .html/.pdf soltos na própria pasta — inclui as concluídas (o
// mostruário é vitrine). Cada tarefa sai com o mesmo shape de tasks.getAll mais os artefatos.
async function listProjectShowcase(project: { id: string; main_route: string }) {
	const rows = await dbTasks.listByProject({ projectId: project.id });

	const withArtifacts = (
		await Promise.all(
			rows.map(async (row) => ({
				row,
				artifacts: await listTaskArtifacts({
					projectRoute: project.main_route,
					folderPath: row.folder_path,
				}),
			})),
		)
	).filter(({ artifacts }) => artifacts.length > 0);

	const mapped = await mapTasks(withArtifacts.map(({ row }) => row));

	return mapped.map((task, index) =>
		Object.assign(task, { artifacts: withArtifacts[index].artifacts }),
	);
}

export const mostruarioRouter = {
	list: protectedProcedure.input(MostruarioListSchema).handler(async ({ input }) => {
		const projects = input.projectId
			? [await dbProjects.getById(input.projectId)].filter((project) => project !== null)
			: await dbProjects.getAll();

		const parts = await Promise.all(projects.map(listProjectShowcase));

		return parts.flat().sort((a, b) => latestArtifact(b.artifacts) - latestArtifact(a.artifacts));
	}),
};
