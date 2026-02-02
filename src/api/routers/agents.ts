import { protectedProcedure } from "../auth/context";
import { dbAgents } from "../db/agents";
import type { agents } from "../db/connection";
import {
	AgentCreateSchema,
	AgentIdSchema,
	AgentReorderSchema,
	AgentUpdateSchema,
} from "../schemas/agents";

const mapAgent = (row: agents) => ({
	id: row.id,
	name: row.name,
	description: row.description ?? undefined,
	color: row.color,
	displayOrder: row.display_order,
	createdAt: row.created_at,
	updatedAt: row.updated_at ?? undefined,
});

export const agentsRouter = {
	list: protectedProcedure.handler(async () => {
		const rows = await dbAgents.getAll();
		return rows.map(mapAgent);
	}),

	getById: protectedProcedure.input(AgentIdSchema).handler(async ({ input }) => {
		const row = await dbAgents.getById(input.id);
		return row ? mapAgent(row) : null;
	}),

	create: protectedProcedure.input(AgentCreateSchema).handler(async ({ input }) => {
		const id = crypto.randomUUID();

		await dbAgents.create({
			id,
			name: input.name,
			description: input.description,
			color: input.color,
		});

		const row = await dbAgents.getById(id);
		return row ? mapAgent(row) : null;
	}),

	update: protectedProcedure.input(AgentUpdateSchema).handler(async ({ input }) => {
		await dbAgents.update({
			id: input.id,
			name: input.name,
			description: input.description,
			color: input.color,
		});

		const row = await dbAgents.getById(input.id);
		return row ? mapAgent(row) : null;
	}),

	delete: protectedProcedure.input(AgentIdSchema).handler(async ({ input }) => {
		await dbAgents.delete(input.id);
		return { success: true };
	}),

	reorder: protectedProcedure.input(AgentReorderSchema).handler(async ({ input }) => {
		await dbAgents.reorder(input.orderedIds);
		return { success: true };
	}),
};
