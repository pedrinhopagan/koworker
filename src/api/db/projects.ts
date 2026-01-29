import type { ProjectDbCreateInput, ProjectDbUpdateInput } from "../schemas/projects";
import { db, type projects } from "./connection";
import { cleanUpdate } from "./helpers";

export const dbProjects = {
	getAll: () => db.selectFrom("projects").selectAll().where("deleted_at", "is", null).execute(),

	getById: (id: string) =>
		db
			.selectFrom("projects")
			.selectAll()
			.where("id", "=", id)
			.where("deleted_at", "is", null)
			.executeTakeFirst(),

	create: (input: ProjectDbCreateInput) =>
		db
			.insertInto("projects")
			.values(input as projects)
			.executeTakeFirst(),

	update: (input: { id: string } & ProjectDbUpdateInput) => {
		const { id, ...values } = input;
		const cleanValues = cleanUpdate(values);

		return db
			.updateTable("projects")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.where("deleted_at", "is", null)
			.executeTakeFirst();
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
};
