import { protectedProcedure } from "../auth/context";
import type { agent_categories } from "../db/connection";
import { dbAgentCategories } from "../db/agent-categories";
import {
	AgentCategoryCreateSchema,
	AgentCategoryIdSchema,
	AgentCategoryUpdateSchema,
} from "../schemas";

const mapAgentCategory = (row: agent_categories) => ({
	id: row.id,
	name: row.name,
	color: row.color,
	displayOrder: row.display_order,
	createdAt: row.created_at,
	updatedAt: row.updated_at ?? undefined,
});

export const agentCategoriesRouter = {
	list: protectedProcedure.handler(async () => {
		const rows = await dbAgentCategories.getAll();
		return rows.map(mapAgentCategory);
	}),

	create: protectedProcedure.input(AgentCategoryCreateSchema).handler(async ({ input }) => {
		const existing = await dbAgentCategories.findByNormalizedName(input.name);
		if (existing) {
			throw new Error("Já existe uma categoria com este nome");
		}

		const id = crypto.randomUUID();

		await dbAgentCategories.create({
			id,
			name: input.name,
			color: input.color,
		});

		const row = await dbAgentCategories.getById(id);
		return row ? mapAgentCategory(row) : null;
	}),

	update: protectedProcedure.input(AgentCategoryUpdateSchema).handler(async ({ input }) => {
		if (input.name) {
			const existing = await dbAgentCategories.findByNormalizedName(input.name, input.id);
			if (existing) {
				throw new Error("Já existe uma categoria com este nome");
			}
		}

		await dbAgentCategories.update({
			id: input.id,
			name: input.name,
			color: input.color,
		});

		const row = await dbAgentCategories.getById(input.id);
		return row ? mapAgentCategory(row) : null;
	}),

	delete: protectedProcedure.input(AgentCategoryIdSchema).handler(async ({ input }) => {
		await dbAgentCategories.delete(input.id);
		return { success: true };
	}),
};
