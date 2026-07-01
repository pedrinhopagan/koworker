import type { SkillTool } from "../helpers/skills-fs";
import { db, type skill_source_paths } from "./connection";

export const dbSkillSourcePaths = {
	list: () =>
		db.selectFrom("skill_source_paths").selectAll().orderBy("created_at", "asc").execute(),

	create: ({ tool, path }: { tool: SkillTool; path: string }) =>
		db
			.insertInto("skill_source_paths")
			.values({
				id: crypto.randomUUID(),
				tool,
				path,
				scope: "custom",
				created_at: Date.now(),
			} as skill_source_paths)
			.executeTakeFirst(),

	// Roots default por plataforma, semeados na primeira execução com scope 'global'. O created_at
	// incremental preserva a prioridade de conteúdo (o primeiro root que tem o slug é o dono).
	seedGlobals: (roots: { tool: SkillTool; path: string }[]) => {
		const base = Date.now();

		return Promise.all(
			roots.map((root, index) =>
				db
					.insertInto("skill_source_paths")
					.values({
						id: crypto.randomUUID(),
						tool: root.tool,
						path: root.path,
						scope: "global",
						created_at: base + index,
					} as skill_source_paths)
					.executeTakeFirst(),
			),
		);
	},

	remove: (id: string) =>
		db.deleteFrom("skill_source_paths").where("id", "=", id).executeTakeFirst(),
};
