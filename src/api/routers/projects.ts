import { protectedProcedure } from "../auth/context";
import { ProjectCreateSchema, ProjectIdSchema, ProjectUpdateSchema } from "../schemas";
import { dbProjects } from "../db/projects";
import type { projects } from "../db/connection";

const mapProject = (row: projects) => ({
	id: row.id,
	name: row.name,
	description: row.description ?? undefined,
	color: row.color,
	mainRoute: row.main_route,
	createdAt: row.created_at,
	updatedAt: row.updated_at ?? undefined,
	deletedAt: row.deleted_at ?? undefined,
});

export const projectsRouter = {
	list: protectedProcedure.handler(async () => {
		const rows = await dbProjects.getAll();
		return rows.map(mapProject);
	}),

	getById: protectedProcedure
		.input(ProjectIdSchema)
		.handler(async ({ input }) => {
			const row = await dbProjects.getById(input.id);
			return row ? mapProject(row) : null;
		}),

	create: protectedProcedure
		.input(ProjectCreateSchema)
		.handler(async ({ input }) => {
			const id = crypto.randomUUID();

			await dbProjects.create({
				id,
				name: input.name,
				description: input.description,
				color: input.color,
				main_route: input.mainRoute,
			});

			const row = await dbProjects.getById(id);
			return row ? mapProject(row) : null;
		}),

	update: protectedProcedure
		.input(ProjectUpdateSchema)
		.handler(async ({ input }) => {
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

	remove: protectedProcedure
		.input(ProjectIdSchema)
		.handler(async ({ input }) => {
			await dbProjects.softDelete(input.id);
			return { id: input.id };
		}),
};
