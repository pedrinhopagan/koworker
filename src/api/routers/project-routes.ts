import { protectedProcedure } from "../auth/context";
import type { project_routes } from "../db/connection";
import { dbProjectRoutes } from "../db/project-routes";
import {
	ProjectRouteCreateSchema,
	ProjectRouteIdSchema,
	ProjectRouteReorderSchema,
	ProjectRouteUpdateSchema,
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

export const projectRoutesRouter = {
	create: protectedProcedure.input(ProjectRouteCreateSchema).handler(async ({ input }) => {
		const id = crypto.randomUUID();

		await dbProjectRoutes.create({
			id,
			project_id: input.projectId,
			name: input.name,
			route: input.route,
			icon: input.icon,
			command: input.command,
		});

		const row = await dbProjectRoutes.getById(id);
		return row ? mapProjectRoute(row) : null;
	}),

	update: protectedProcedure.input(ProjectRouteUpdateSchema).handler(async ({ input }) => {
		await dbProjectRoutes.update({
			id: input.id,
			name: input.name,
			route: input.route,
			icon: input.icon,
			command: input.command,
		});

		const row = await dbProjectRoutes.getById(input.id);
		return row ? mapProjectRoute(row) : null;
	}),

	delete: protectedProcedure.input(ProjectRouteIdSchema).handler(async ({ input }) => {
		await dbProjectRoutes.delete(input.id);
		return { success: true };
	}),

	reorder: protectedProcedure.input(ProjectRouteReorderSchema).handler(async ({ input }) => {
		await dbProjectRoutes.reorder(input.orderedIds);
		return { success: true };
	}),
};
