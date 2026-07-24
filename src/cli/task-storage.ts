import { dbProjects } from "@/api/db/projects";
import { withProjectStorageLock } from "@/api/helpers/task-storage-coordinator";

export async function withCliTaskStorageLock<T>(
	row: { project_id: string },
	operation: (project: NonNullable<Awaited<ReturnType<typeof dbProjects.getById>>>) => Promise<T>,
) {
	const project = await dbProjects.getById(row.project_id);
	if (!project) throw new Error("Projeto não encontrado");
	return withProjectStorageLock({ projectId: project.id, projectRoute: project.main_route }, () =>
		operation(project),
	);
}
