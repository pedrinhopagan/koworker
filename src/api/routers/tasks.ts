import { protectedProcedure } from "../auth/context";
import { dbCategories } from "../db/categories";
import type { tasks } from "../db/connection";
import { dbPriorities } from "../db/priorities";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import {
	buildFolderPath,
	createTaskFolder,
	extractTitleFromMarkdown,
	PRIMARY_FILE,
	readTaskFiles,
	removeTaskFolder,
	writeTaskFile,
} from "../helpers/task-folder";
import { restartTasksWatcher } from "../helpers/tasks-watcher";
import { PubSub } from "../pubsub";
import {
	TaskCreateSchema,
	TaskFocusSchema,
	TaskGetAllSchema,
	TaskIdSchema,
	TaskListByDateSchema,
	TaskListByProjectSchema,
	TaskListByWeekSchema,
	TaskMetricsSchema,
	TaskSetDoneSchema,
	TaskUpdateSchema,
	TaskWriteFileSchema,
} from "../schemas";

const mapTask = (row: tasks) => ({
	id: row.id,
	projectId: row.project_id,
	folderPath: row.folder_path,
	title: row.title,
	priorityId: row.priority_id,
	categoryId: row.category_id,
	scheduledDate: row.scheduled_date ?? undefined,
	scheduledTime: row.scheduled_time ?? undefined,
	done: Boolean(row.done),
	completedAt: row.completed_at ?? undefined,
	createdAt: row.created_at,
	updatedAt: row.updated_at ?? undefined,
	deletedAt: row.deleted_at ?? undefined,
});

async function publishTaskEvent(
	taskId: string,
	projectId: string,
	action: "created" | "updated" | "deleted",
) {
	await PubSub.publish("tasks", projectId, { taskId, projectId, action, source: "api" });
	await PubSub.publish("tasks", "global", { taskId, projectId, action, source: "api" });
}

export const tasksRouter = {
	metrics: protectedProcedure.input(TaskMetricsSchema).handler(async ({ input }) => {
		const result = await dbTasks.getMetrics(input.projectId);
		return {
			total: result?.total ?? 0,
			pending: result?.pending ?? 0,
			done: result?.done ?? 0,
		};
	}),

	focus: protectedProcedure.input(TaskFocusSchema).handler(async ({ input }) => {
		const row = await dbTasks.getFocusTask(input.projectId ?? null);
		if (!row) return null;
		return mapTask(row);
	}),

	getAll: protectedProcedure.input(TaskGetAllSchema).handler(async ({ input }) => {
		const rows = await dbTasks.getAll({
			projectId: input.projectId ?? null,
			date: input.date,
			startDate: input.startDate,
			endDate: input.endDate,
			includeCompleted: input.includeCompleted,
			taskTypeId: input.taskTypeId,
			priorityId: input.priorityId,
			priority: input.priority,
			q: input.q,
		});

		return rows.map(mapTask);
	}),

	listByProject: protectedProcedure.input(TaskListByProjectSchema).handler(async ({ input }) => {
		const rows = await dbTasks.listByProject(input);
		return rows.map(mapTask);
	}),

	listByDate: protectedProcedure.input(TaskListByDateSchema).handler(async ({ input }) => {
		const rows = await dbTasks.listByDate(input.date, input);
		return rows.map(mapTask);
	}),

	listByWeek: protectedProcedure.input(TaskListByWeekSchema).handler(async ({ input }) => {
		const rows = await dbTasks.listByDateRange(input.startDate, input.endDate, input);
		return rows.map(mapTask);
	}),

	getById: protectedProcedure.input(TaskIdSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		return row ? mapTask(row) : null;
	}),

	getFull: protectedProcedure.input(TaskIdSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		if (!row) return null;

		const [category, priority, project] = await Promise.all([
			dbCategories.getById(row.category_id),
			dbPriorities.getById(row.priority_id),
			dbProjects.getById(row.project_id),
		]);

		const { files, primaryFile } = project
			? await readTaskFiles({ projectRoute: project.main_route, folderPath: row.folder_path })
			: { files: [], primaryFile: null };

		return {
			...mapTask(row),
			files,
			primaryFile,
			category: category ? { id: category.id, name: category.name, color: category.color } : null,
			priority: priority
				? { id: priority.id, name: priority.name, color: priority.color, level: priority.level }
				: null,
			project: project
				? {
						id: project.id,
						name: project.name,
						color: project.color,
						mainRoute: project.main_route,
					}
				: null,
		};
	}),

	create: protectedProcedure.input(TaskCreateSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		const id = crypto.randomUUID();
		const folderPath = buildFolderPath(id);

		await createTaskFolder({
			projectRoute: project.main_route,
			folderPath,
			title: input.title,
		});

		await dbTasks.create({
			id,
			project_id: input.projectId,
			folder_path: folderPath,
			title: input.title,
			priority_id: input.priorityId,
			category_id: input.categoryId,
			scheduled_date: input.scheduledDate,
			scheduled_time: input.scheduledTime,
		});

		await publishTaskEvent(id, input.projectId, "created");
		// A pasta `.koworker/` do projeto pode ter acabado de nascer; ressintoniza o watcher.
		restartTasksWatcher();

		const row = await dbTasks.getById(id);
		return row ? mapTask(row) : null;
	}),

	update: protectedProcedure.input(TaskUpdateSchema).handler(async ({ input }) => {
		await dbTasks.update({
			id: input.id,
			title: input.title,
			priority_id: input.priorityId,
			category_id: input.categoryId,
			scheduled_date: input.scheduledDate,
			scheduled_time: input.scheduledTime,
			done: input.done === undefined ? undefined : input.done ? 1 : 0,
			completed_at: input.done === undefined ? undefined : input.done ? Date.now() : null,
		});

		const row = await dbTasks.getById(input.id);
		if (row) {
			await publishTaskEvent(row.id, row.project_id, "updated");
		}
		return row ? mapTask(row) : null;
	}),

	setDone: protectedProcedure.input(TaskSetDoneSchema).handler(async ({ input }) => {
		await dbTasks.update({
			id: input.id,
			done: input.done ? 1 : 0,
			completed_at: input.done ? Date.now() : null,
		});

		const row = await dbTasks.getById(input.id);
		if (row) {
			await publishTaskEvent(row.id, row.project_id, "updated");
		}
		return row ? mapTask(row) : null;
	}),

	writeFile: protectedProcedure.input(TaskWriteFileSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		if (!row) throw new Error("Tarefa não encontrada");

		const project = await dbProjects.getById(row.project_id);
		if (!project) throw new Error("Projeto não encontrado");

		await writeTaskFile({
			projectRoute: project.main_route,
			folderPath: row.folder_path,
			name: input.name,
			content: input.content,
		});

		// O H1 do index.md é a fonte de verdade do título: mantém o banco em sync.
		if (input.name === PRIMARY_FILE) {
			const title = extractTitleFromMarkdown(input.content);
			if (title && title !== row.title) {
				await dbTasks.update({ id: row.id, title });
			}
		}

		await publishTaskEvent(row.id, row.project_id, "updated");
		return { id: row.id, name: input.name };
	}),

	remove: protectedProcedure.input(TaskIdSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		await dbTasks.softDelete(input.id);

		if (row) {
			const project = await dbProjects.getById(row.project_id);
			if (project) {
				await removeTaskFolder({
					projectRoute: project.main_route,
					folderPath: row.folder_path,
				});
			}
			await publishTaskEvent(row.id, row.project_id, "deleted");
		}
		return { id: input.id };
	}),
};
