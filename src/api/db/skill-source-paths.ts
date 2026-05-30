import type { SkillTool } from "../helpers/skills-fs";
import { db, type skill_source_paths } from "./connection";

export const dbSkillSourcePaths = {
	list: () =>
		db.selectFrom("skill_source_paths").selectAll().orderBy("created_at", "asc").execute(),

	create: ({ tool, path }: { tool: SkillTool; path: string }) =>
		db
			.insertInto("skill_source_paths")
			.values({ id: crypto.randomUUID(), tool, path, created_at: Date.now() } as skill_source_paths)
			.executeTakeFirst(),

	remove: (id: string) =>
		db.deleteFrom("skill_source_paths").where("id", "=", id).executeTakeFirst(),
};
