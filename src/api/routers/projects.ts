import { protectedProcedure } from "../auth/context";
import type { project_routes, projects } from "../db/connection";
import { dbProjectRoutes } from "../db/project-routes";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import {
	ProjectCreateSchema,
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
		const inProgress = Number(row.tasks_in_execution ?? 0);
		const progress = total === 0 ? 0 : Math.round((done / total) * 100);

		return {
			...mapProject(row),
			tasksSummary: {
				total,
				pending,
				inProgress,
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

		const defaultRoutes = [
			{ name: "claude", command: "claude --dangerously-skip-permissions" },
			{ name: "opencode", command: "opencode" },
			{ name: "codex", command: "codex" },
		];

		for (const route of defaultRoutes) {
			await dbProjectRoutes.create({
				id: crypto.randomUUID(),
				project_id: id,
				name: route.name,
				route: input.mainRoute,
				icon: "Cpu",
				command: route.command,
			});
		}

		const row = await dbProjects.getById(id);
		return row ? mapProject(row) : null;
	}),

	update: protectedProcedure.input(ProjectUpdateSchema).handler(async ({ input }) => {
		await dbProjects.update({
			id: input.id,
			name: input.name,
			description: input.description,
			color: input.color,
			main_route: input.mainRoute,
		});

		const row = await dbProjects.getById(input.id);
		return row ? mapProject(row) : null;
	}),

	remove: protectedProcedure.input(ProjectIdSchema).handler(async ({ input }) => {
		await dbProjects.softDelete(input.id);
		return { id: input.id };
	}),

	reorder: protectedProcedure.input(ProjectReorderSchema).handler(async ({ input }) => {
		await dbProjects.reorder(input.orderedIds);
		return { success: true };
	}),

	stats: protectedProcedure.handler(async () => {
		const statsRows = await dbTasks.getStatsByProject();
		return statsRows.map((row) => ({
			projectId: row.project_id,
			total: Number(row.total) || 0,
			pending: Number(row.pending) || 0,
			inProgress: Number(row.in_progress) || 0,
			done: Number(row.done) || 0,
			lastUpdated: row.last_updated ?? undefined,
		}));
	}),
};
