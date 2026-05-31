import { protectedProcedure } from "../auth/context";
import type { project_routes, projects } from "../db/connection";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { listProjectDocs, writeProjectDoc } from "../helpers/project-docs";
import { restartTasksWatcher } from "../helpers/tasks-watcher";
import {
	ProjectCreateSchema,
	ProjectDocWriteSchema,
	ProjectIdSchema,
	ProjectReorderSchema,
	ProjectUpdateSchema,
} from "../schemas";

const mapProjectRoute = (row: project_routes) => ({
	id: row.id,
	projectId: row.project_id,
	name: row.name,
	route: row.route,
	icon: row.icon ?? undefined,
	command: row.command ?? undefined,
	displayOrder: row.display_order,
	createdAt: row.created_at,
	updatedAt: row.updated_at ?? undefined,
});

const mapProject = (row: projects & { routes?: project_routes[] }) => ({
	id: row.id,
	name: row.name,
	description: row.description ?? undefined,
	color: row.color,
	mainRoute: row.main_route,
	hideTerminal: row.hide_terminal === 1,
	displayOrder: row.display_order,
	createdAt: row.created_at,
	updatedAt: row.updated_at ?? undefined,
	deletedAt: row.deleted_at ?? undefined,
	routes: row.routes?.map(mapProjectRoute) ?? [],
});

export const projectsRouter = {
	list: protectedProcedure.handler(async () => {
		const rows = await dbProjects.getAll();
		return rows.map(mapProject);
	}),

	getById: protectedProcedure.input(ProjectIdSchema).handler(async ({ input }) => {
		const row = await dbProjects.getByIdWithSummary(input.id);
		if (!row) return null;

		const total = Number(row.tasks_total ?? 0);
		const done = Number(row.tasks_done ?? 0);
		const pending = Number(row.tasks_pending ?? 0);
		const progress = total === 0 ? 0 : Math.round((done / total) * 100);

		return {
			...mapProject(row),
			tasksSummary: {
				total,
				pending,
				done,
				progress,
			},
		};
	}),

	create: protectedProcedure.input(ProjectCreateSchema).handler(async ({ input }) => {
		const id = crypto.randomUUID();

		await dbProjects.create({
			id,
			name: input.name,
			description: input.description,
			color: input.color,
			main_route: input.mainRoute,
		});

		const row = await dbProjects.getById(id);
		restartTasksWatcher();
		return row ? mapProject(row) : null;
	}),

	update: protectedProcedure.input(ProjectUpdateSchema).handler(async ({ input }) => {
		await dbProjects.update({
			id: input.id,
			name: input.name,
			description: input.description,
			color: input.color,
			main_route: input.mainRoute,
			hide_terminal: input.hideTerminal === undefined ? undefined : input.hideTerminal ? 1 : 0,
		});

		const row = await dbProjects.getById(input.id);
		restartTasksWatcher();
		return row ? mapProject(row) : null;
	}),

	remove: protectedProcedure.input(ProjectIdSchema).handler(async ({ input }) => {
		await dbProjects.softDelete(input.id);
		restartTasksWatcher();
		return { id: input.id };
	}),

	reorder: protectedProcedure.input(ProjectReorderSchema).handler(async ({ input }) => {
		await dbProjects.reorder(input.orderedIds);
		return { success: true };
	}),

	listDocs: protectedProcedure.input(ProjectIdSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.id);
		if (!project) return [];

		return listProjectDocs(project.main_route);
	}),

	writeDoc: protectedProcedure.input(ProjectDocWriteSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.id);
		if (!project) throw new Error("Projeto não encontrado");

		await writeProjectDoc({
			projectRoute: project.main_route,
			path: input.path,
			content: input.content,
		});

		return { path: input.path };
	}),

	stats: protectedProcedure.handler(async () => {
		const statsRows = await dbTasks.getStatsByProject();
		return statsRows.map((row) => ({
			projectId: row.project_id,
			total: Number(row.total) || 0,
			pending: Number(row.pending) || 0,
			done: Number(row.done) || 0,
			lastUpdated: row.last_updated ?? undefined,
		}));
	}),
};
