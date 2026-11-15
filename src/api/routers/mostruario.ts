import { protectedProcedure } from "../auth/context";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { listTaskArtifacts, type TaskArtifactMeta } from "../helpers/koworker-assets";
import { MostruarioListSchema } from "../schemas";
import { prepareShowcaseSearch, searchShowcaseArtifact } from "../helpers/mostruario-search";
import { mapTasks } from "../helpers/task-display";

function latestArtifact(artifacts: TaskArtifactMeta[]): number {
	return artifacts.reduce((max, artifact) => Math.max(max, artifact.mtime), 0);
}

async function listProjectShowcase(project: { id: string; main_route: string }, query?: string) {
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

	const search = prepareShowcaseSearch(query ?? "");
	const tasks = await Promise.all(
		mapped.map(async (task, index) => {
			const artifacts = await Promise.all(
				withArtifacts[index].artifacts.map(async (artifact) => {
					const match = query
						? await searchShowcaseArtifact({
								projectRoute: project.main_route,
								folderPath: task.folderPath,
								taskTitle: task.displayTitle,
								artifact,
								search,
							})
						: null;
					return Object.assign(artifact, { match });
				}),
			);
			const matches = artifacts.filter((artifact) => !query || artifact.match);
			matches.sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0));
			return Object.assign(task, { artifacts: matches });
		}),
	);
	return tasks.filter((task) => task.artifacts.length > 0);
}

export const mostruarioRouter = {
	list: protectedProcedure.input(MostruarioListSchema).handler(async ({ input }) => {
		const projects = input.projectId
			? [await dbProjects.getById(input.projectId)].filter((project) => project !== null)
			: await dbProjects.getAll();

		const parts = await Promise.all(
			projects.map((project) => listProjectShowcase(project, input.query)),
		);

		return parts
			.flat()
			.sort(
				(a, b) =>
					(b.artifacts[0]?.match?.score ?? 0) - (a.artifacts[0]?.match?.score ?? 0) ||
					latestArtifact(b.artifacts) - latestArtifact(a.artifacts),
			);
	}),
};
