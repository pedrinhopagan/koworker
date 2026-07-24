import { protectedProcedure } from "../auth/context";
import type { task_groups } from "../db/connection";
import { dbProjects } from "../db/projects";
import { dbTaskGroups } from "../db/task-groups";
import { dbTasks } from "../db/tasks";
import { relinkTasks, withProjectStorageLock } from "../helpers/task-storage-coordinator";
import { allocateStorageKey, normalizeStorageSlug } from "../helpers/task-storage-path";
import {
	TaskGroupCreateSchema,
	TaskGroupIdSchema,
	TaskGroupListSchema,
	TaskGroupReorderSchema,
	TaskGroupUpdateSchema,
} from "../schemas";

const mapTaskGroup = (row: task_groups) => ({
	id: row.id,
	projectId: row.project_id,
	name: row.name,
	color: row.color,
	displayOrder: row.display_order,
	createdAt: row.created_at,
	updatedAt: row.updated_at ?? undefined,
});

export const taskGroupsRouter = {
	list: protectedProcedure.input(TaskGroupListSchema).handler(async ({ input }) => {
		const rows = input.projectId
			? await dbTaskGroups.listByProject(input.projectId)
			: await dbTaskGroups.listAll();
		return rows.map(mapTaskGroup);
	}),

	create: protectedProcedure.input(TaskGroupCreateSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");
		const id = await withProjectStorageLock(
			{ projectId: project.id, projectRoute: project.main_route },
			async () => {
				const nextId = crypto.randomUUID();
				const storageKey = allocateStorageKey({
					id: nextId,
					usedKeys: new Set(
						(await dbTaskGroups.listStorageKeys()).flatMap((row) =>
							row.storage_key ? [row.storage_key] : [],
						),
					),
				});

				await dbTaskGroups.create({
					id: nextId,
					project_id: input.projectId,
					name: input.name,
					storage_key: storageKey,
					storage_slug: normalizeStorageSlug(input.name, "feature"),
					color: input.color,
				});
				return nextId;
			},
		);

		const row = await dbTaskGroups.getById(id);
		return row ? mapTaskGroup(row) : null;
	}),

	update: protectedProcedure.input(TaskGroupUpdateSchema).handler(async ({ input }) => {
		const current = await dbTaskGroups.getById(input.id);
		if (!current) throw new Error("Feature não encontrada");
		const project = await dbProjects.getById(current.project_id);
		if (!project) throw new Error("Projeto não encontrado");
		await withProjectStorageLock({ projectId: project.id, projectRoute: project.main_route }, () =>
			dbTaskGroups.update({ id: input.id, name: input.name, color: input.color }),
		);

		const row = await dbTaskGroups.getById(input.id);
		return row ? mapTaskGroup(row) : null;
	}),

	delete: protectedProcedure.input(TaskGroupIdSchema).handler(async ({ input }) => {
		const group = await dbTaskGroups.getById(input.id);
		if (!group) throw new Error("Feature não encontrada");
		const project = await dbProjects.getById(group.project_id);
		if (!project) throw new Error("Projeto não encontrado");
		const tasks = (await dbTasks.listByProject({ projectId: project.id })).filter(
			(task) => task.group_id === group.id,
		);

		if (tasks.length > 0) {
			await relinkTasks({
				intents: tasks.map((task) => ({
					taskId: task.id,
					targetProjectId: project.id,
					targetGroupId: null,
				})),
				deleteGroupIdAfter: group.id,
			});
		} else {
			await withProjectStorageLock(
				{ projectId: project.id, projectRoute: project.main_route },
				() => dbTaskGroups.delete(group.id),
			);
		}
		return { success: true };
	}),

	reorder: protectedProcedure.input(TaskGroupReorderSchema).handler(async ({ input }) => {
		const groups = await Promise.all(input.orderedIds.map((id) => dbTaskGroups.getById(id)));
		if (groups.some((group) => !group)) throw new Error("Uma feature não foi encontrada");
		const projectIds = new Set(groups.map((group) => group?.project_id));
		if (projectIds.size !== 1) throw new Error("A ordenação mistura projetos distintos");
		const projectId = groups[0]?.project_id;
		if (!projectId) throw new Error("Projeto não encontrado");
		const project = await dbProjects.getById(projectId);
		if (!project) throw new Error("Projeto não encontrado");
		await withProjectStorageLock({ projectId: project.id, projectRoute: project.main_route }, () =>
			dbTaskGroups.reorder(input.orderedIds),
		);
		return { success: true };
	}),
};
