import { sql } from "kysely";

import { DEFAULT_PROJECT_ROUTES } from "@/constants/projects";
import type { ProjectDbCreateInput, ProjectDbUpdateInput } from "../schemas/projects";
import { db, type projects } from "./connection";
import { cleanUpdate } from "./helpers";
import { dbProjectRoutes } from "./project-routes";

export const dbProjects = {
	getAll: async () => {
		const projects = await db
			.selectFrom("projects")
			.selectAll()
			.where("deleted_at", "is", null)
			.orderBy("display_order", "asc")
			.execute();

		const projectsWithRoutes = await Promise.all(
			projects.map(async (project) => {
				const routes = await db
					.selectFrom("project_routes")
					.selectAll()
					.where("project_id", "=", project.id)
					.orderBy("display_order", "asc")
					.execute();

				return Object.assign({}, project, { routes });
			}),
		);

		return projectsWithRoutes;
	},

	// Nome → diretório real de cada projeto ativo. O projeto é dono de onde mora (`main_route`);
	// quem precisa achar arquivos do projeto pergunta aqui em vez de adivinhar a partir do nome.
	listRoots: () =>
		db
			.selectFrom("projects")
			.select(["name", "main_route"])
			.where("deleted_at", "is", null)
			.orderBy("display_order", "asc")
			.execute(),

	getById: async (id: string) => {
		const project = await db
			.selectFrom("projects")
			.selectAll()
			.where("id", "=", id)
			.where("deleted_at", "is", null)
			.executeTakeFirst();

		if (!project) return null;

		const routes = await db
			.selectFrom("project_routes")
			.selectAll()
			.where("project_id", "=", id)
			.orderBy("display_order", "asc")
			.execute();

		return Object.assign({}, project, { routes });
	},

	getByIdWithSummary: async (id: string) => {
		const project = await db
			.selectFrom("projects")
			.leftJoin("tasks", (join) =>
				join.onRef("tasks.project_id", "=", "projects.id").on("tasks.deleted_at", "is", null),
			)
			.selectAll("projects")
			.select([
				sql<number>`count(tasks.id)`.as("tasks_total"),
				sql<number>`sum(case when tasks.done = 1 then 1 else 0 end)`.as("tasks_done"),
				sql<number>`sum(case when tasks.done = 0 then 1 else 0 end)`.as("tasks_pending"),
			])
			.where("projects.id", "=", id)
			.where("projects.deleted_at", "is", null)
			.groupBy("projects.id")
			.executeTakeFirst();

		if (!project) return null;

		const routes = await db
			.selectFrom("project_routes")
			.selectAll()
			.where("project_id", "=", id)
			.orderBy("display_order", "asc")
			.execute();

		return Object.assign({}, project, { routes });
	},

	create: async (input: ProjectDbCreateInput) => {
		const maxOrder = await db
			.selectFrom("projects")
			.select(({ fn }) => [fn.max("display_order").as("maxOrder")])
			.where("deleted_at", "is", null)
			.executeTakeFirst();

		const displayOrder = ((maxOrder?.maxOrder as number | null) ?? -1) + 1;

		const result = await db
			.insertInto("projects")
			.values({ ...(input as projects), display_order: displayOrder })
			.executeTakeFirst();

		// Criar um projeto = criá-lo já com suas rotas padrão. Mora aqui (não no router) pra que
		// UI e CLI passem pelo mesmo dono e nenhum projeto nasça sem atalhos.
		for (const route of DEFAULT_PROJECT_ROUTES) {
			await dbProjectRoutes.create({
				id: crypto.randomUUID(),
				project_id: input.id,
				name: route.name,
				route: input.main_route,
				icon: "Cpu",
				command: route.command,
			});
		}

		return result;
	},

	update: async (input: { id: string } & ProjectDbUpdateInput) => {
		const { id, ...values } = input;
		const cleanValues = cleanUpdate(values);

		// Mover o main_route precisa reescrever o prefixo das rotas do projeto, senão os atalhos
		// apontariam pra um caminho que não existe mais. Lê o anterior só quando o route muda.
		const previous =
			values.main_route === undefined
				? null
				: await db
						.selectFrom("projects")
						.select("main_route")
						.where("id", "=", id)
						.where("deleted_at", "is", null)
						.executeTakeFirst();

		const result = await db
			.updateTable("projects")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.where("deleted_at", "is", null)
			.executeTakeFirst();

		if (values.main_route !== undefined && previous && values.main_route !== previous.main_route) {
			await dbProjectRoutes.rewritePrefix({
				projectId: id,
				oldPrefix: previous.main_route,
				newPrefix: values.main_route,
			});
		}

		return result;
	},

	softDelete: (id: string) =>
		db
			.updateTable("projects")
			.set({
				deleted_at: Date.now(),
				updated_at: Date.now(),
			})
			.where("id", "=", id)
			.where("deleted_at", "is", null)
			.executeTakeFirst(),

	reorder: async (orderedIds: string[]) => {
		await db.transaction().execute(async (trx) => {
			for (const [index, id] of orderedIds.entries()) {
				await trx
					.updateTable("projects")
					.set({ display_order: index, updated_at: Date.now() })
					.where("id", "=", id)
					.where("deleted_at", "is", null)
					.executeTakeFirst();
			}
		});
	},
};
